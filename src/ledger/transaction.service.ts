import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../common/enums/role.enum.js';
import { AccountPort } from './account-port.js';
import { MoneyOperationDto } from './dto/money-operation.dto.js';
import { QueryTransactionDto } from './dto/query-transaction.dto.js';
import { TransferDto } from './dto/transfer.dto.js';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { TransactionStatus, TransactionType } from './enums/transaction-type.enum.js';
import { centsToYuan } from './utils/money.util.js';

/** MySQL 唯一键冲突错误码 */
function isDuplicateKeyError(error: unknown): boolean {
  const err = error as {
    code?: string;
    errno?: number;
    driverError?: { code?: string; errno?: number };
  };
  const code = err.code ?? err.driverError?.code;
  const errno = err.errno ?? err.driverError?.errno;
  return code === 'ER_DUP_ENTRY' || errno === 1062;
}

/**
 * 资金操作服务。
 *
 * 一致性保障：
 * 1. 所有余额变更都在数据库事务内完成，失败整体回滚；
 * 2. 使用悲观写锁（SELECT ... FOR UPDATE）串行化同一账户的并发变更；
 * 3. 涉及两个账户时按 id 升序加锁，避免相互等待造成死锁；
 * 4. txnNo 作为幂等键，配合唯一索引保证重复请求只入账一次；
 * 5. 每笔流水记录变动后余额快照，便于对账。
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    private readonly accountPort: AccountPort,
    private readonly dataSource: DataSource,
  ) {}

  /** 存入：资金由外部流入账户 */
  async deposit(dto: MoneyOperationDto, operator: AuthUser, authHeader?: string) {
    const txnNo = dto.txnNo ?? this.generateTxnNo('DP');

    return this.runIdempotent(txnNo, async (manager) => {
      // 幂等前置检查：该 txnNo 已入账则直接返回既有流水，避免重复变更余额
      const existed = await manager.findOneBy(Transaction, { txnNo });
      if (existed) return existed;

      // 通过账户网关校验（本地或 HTTP）：存在 + 归属（入金不校验冻结）
      await this.accountPort.validateAccount(dto.accountId, 'deposit', operator, authHeader);

      const account = await this.lockAccount(manager, dto.accountId);

      account.balance += dto.amount;
      await manager.save(account);

      return manager.save(
        manager.create(Transaction, {
          txnNo,
          type: TransactionType.Deposit,
          amount: dto.amount,
          fromAccountId: null,
          toAccountId: account.id,
          fromBalanceAfter: null,
          toBalanceAfter: account.balance,
          status: TransactionStatus.Success,
          remark: dto.remark ?? null,
          operatorId: operator.userId,
        }),
      );
    });
  }

  /** 取出：资金由账户流向外部 */
  async withdraw(dto: MoneyOperationDto, operator: AuthUser, authHeader?: string) {
    const txnNo = dto.txnNo ?? this.generateTxnNo('WD');

    return this.runIdempotent(txnNo, async (manager) => {
      // 幂等前置检查
      const existed = await manager.findOneBy(Transaction, { txnNo });
      if (existed) return existed;

      // 通过账户网关校验（本地或 HTTP）：存在 + 归属 + 未冻结
      await this.accountPort.validateAccount(dto.accountId, 'withdraw', operator, authHeader);

      const account = await this.lockAccount(manager, dto.accountId);
      this.assertSufficient(account, dto.amount);

      account.balance -= dto.amount;
      await manager.save(account);

      return manager.save(
        manager.create(Transaction, {
          txnNo,
          type: TransactionType.Withdraw,
          amount: dto.amount,
          fromAccountId: account.id,
          toAccountId: null,
          fromBalanceAfter: account.balance,
          toBalanceAfter: null,
          status: TransactionStatus.Success,
          remark: dto.remark ?? null,
          operatorId: operator.userId,
        }),
      );
    });
  }

  /** 转账：账户之间划转 */
  async transfer(dto: TransferDto, operator: AuthUser, authHeader?: string) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('转出账户与转入账户不能相同');
    }
    const txnNo = dto.txnNo ?? this.generateTxnNo('TF');

    return this.runIdempotent(txnNo, async (manager) => {
      // 幂等前置检查
      const existed = await manager.findOneBy(Transaction, { txnNo });
      if (existed) return existed;

      // 通过账户网关校验（本地或 HTTP）：转出方需归属 + 未冻结，收款方仅需未冻结
      await this.accountPort.validateAccount(dto.fromAccountId, 'withdraw', operator, authHeader);
      await this.accountPort.validateAccount(dto.toAccountId, 'receive', operator, authHeader);

      // 按 id 升序加锁：保证 A→B 与 B→A 并发时加锁顺序一致，避免死锁
      const ids = [dto.fromAccountId, dto.toAccountId].sort((a, b) => a - b);
      const locked = await manager.find(Account, {
        where: { id: In(ids) },
        lock: { mode: 'pessimistic_write' },
      });
      if (locked.length !== 2) {
        throw new NotFoundException('转出或转入账户不存在');
      }

      const from = locked.find((item) => item.id === dto.fromAccountId) as Account;
      const to = locked.find((item) => item.id === dto.toAccountId) as Account;

      // 余额与币种一致性在本地锁内校验（归属/冻结已由账户网关完成）
      this.assertSufficient(from, dto.amount);
      if (from.currency !== to.currency) {
        throw new BadRequestException(
          `币种不一致（${from.currency} → ${to.currency}），暂不支持跨币种转账`,
        );
      }

      from.balance -= dto.amount;
      to.balance += dto.amount;
      await manager.save([from, to]);

      return manager.save(
        manager.create(Transaction, {
          txnNo,
          type: TransactionType.Transfer,
          amount: dto.amount,
          fromAccountId: from.id,
          toAccountId: to.id,
          fromBalanceAfter: from.balance,
          toBalanceAfter: to.balance,
          status: TransactionStatus.Success,
          remark: dto.remark ?? null,
          operatorId: operator.userId,
        }),
      );
    });
  }

  /** 流水分页查询，普通用户仅能查看自己名下账户的流水 */
  async findPage(query: QueryTransactionDto, operator: AuthUser, authHeader?: string) {
    const page = Number.isFinite(query.page) && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize =
      Number.isFinite(query.pageSize) && query.pageSize > 0
        ? Math.min(Math.floor(query.pageSize), 100)
        : 10;

    const qb = this.txnRepo.createQueryBuilder('txn');
    const isAdmin = operator.roles.includes(Role.Admin);

    if (!isAdmin) {
      const ownedIds = await this.accountPort.findIdsByOwner(operator.userId, authHeader);
      if (query.accountId !== undefined) {
        if (!ownedIds.includes(query.accountId)) {
          throw new ForbiddenException('无权查看该账户的流水');
        }
        qb.andWhere('(txn.fromAccountId = :aid OR txn.toAccountId = :aid)', {
          aid: query.accountId,
        });
      } else {
        if (ownedIds.length === 0) {
          return { list: [], total: 0, page, pageSize };
        }
        qb.andWhere('(txn.fromAccountId IN (:...ownedIds) OR txn.toAccountId IN (:...ownedIds))', {
          ownedIds,
        });
      }
    } else if (query.accountId !== undefined) {
      qb.andWhere('(txn.fromAccountId = :aid OR txn.toAccountId = :aid)', {
        aid: query.accountId,
      });
    }

    if (query.type) {
      qb.andWhere('txn.type = :type', { type: query.type });
    }
    if (query.startTime) {
      qb.andWhere('txn.createTime >= :startTime', { startTime: new Date(query.startTime) });
    }
    if (query.endTime) {
      qb.andWhere('txn.createTime <= :endTime', { endTime: new Date(query.endTime) });
    }

    const [list, total] = await qb
      .orderBy('txn.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      list: list.map((item) => this.toView(item)),
      total,
      page,
      pageSize,
    };
  }

  /** 按业务流水号查询 */
  async findByTxnNo(txnNo: string, operator: AuthUser, authHeader?: string) {
    const txn = await this.txnRepo.findOneBy({ txnNo });
    if (!txn) {
      throw new NotFoundException(`流水 ${txnNo} 不存在`);
    }

    if (!operator.roles.includes(Role.Admin)) {
      const ownedIds = await this.accountPort.findIdsByOwner(operator.userId, authHeader);
      const related = [txn.fromAccountId, txn.toAccountId].filter(
        (id): id is number => id !== null,
      );
      if (!related.some((id) => ownedIds.includes(id))) {
        throw new ForbiddenException('无权查看该流水');
      }
    }

    return this.toView(txn);
  }

  /**
   * 事务 + 幂等封装。
   * 并发提交相同 txnNo 时，后到的事务会撞唯一索引，此时回查并返回既有流水。
   */
  private async runIdempotent(
    txnNo: string,
    work: (manager: EntityManager) => Promise<Transaction>,
  ) {
    try {
      const txn = await this.dataSource.transaction(work);
      return this.toView(txn);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existed = await this.txnRepo.findOneBy({ txnNo });
        if (existed) {
          this.logger.warn(`重复请求已忽略，txnNo=${txnNo}`);
          return this.toView(existed);
        }
      }
      throw error;
    }
  }

  /** 加悲观写锁读取账户，锁在事务提交时释放 */
  private async lockAccount(manager: EntityManager, id: number): Promise<Account> {
    const account = await manager.findOne(Account, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!account) {
      throw new NotFoundException(`账户 ${id} 不存在`);
    }
    return account;
  }

  private assertSufficient(account: Account, amount: number): void {
    if (account.balance < amount) {
      throw new BadRequestException(
        `账户余额不足：当前 ${centsToYuan(account.balance)} 元，需要 ${centsToYuan(amount)} 元`,
      );
    }
  }

  private generateTxnNo(prefix: string): string {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    return `${prefix}${stamp}${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  toView(txn: Transaction) {
    return {
      id: txn.id,
      txnNo: txn.txnNo,
      type: txn.type,
      /** 金额（分） */
      amount: txn.amount,
      /** 金额（元，仅展示用） */
      amountYuan: centsToYuan(txn.amount),
      fromAccountId: txn.fromAccountId,
      toAccountId: txn.toAccountId,
      fromBalanceAfter: txn.fromBalanceAfter,
      toBalanceAfter: txn.toBalanceAfter,
      status: txn.status,
      remark: txn.remark,
      operatorId: txn.operatorId,
      createTime: txn.createTime,
    };
  }
}
