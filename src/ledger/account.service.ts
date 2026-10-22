import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { QueryAccountDto } from './dto/query-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { Account } from './entities/account.entity.js';
import { AccountStatus, AccountType } from './enums/account-type.enum.js';
import { centsToYuan } from './utils/money.util.js';

const MAX_PAGE_SIZE = 100;

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  /** 创建账户，余额恒为 0（只能通过资金操作产生） */
  async create(dto: CreateAccountDto, operator: AuthUser) {
    const account = this.accountRepo.create({
      accountNo: this.generateAccountNo(),
      name: dto.name,
      type: dto.type ?? AccountType.Asset,
      currency: dto.currency ?? 'CNY',
      balance: 0,
      status: AccountStatus.Normal,
      ownerId: dto.ownerId ?? operator.userId,
    });

    return this.toView(await this.accountRepo.save(account));
  }

  async findPage(query: QueryAccountDto) {
    const page = Number.isFinite(query.page) && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize =
      Number.isFinite(query.pageSize) && query.pageSize > 0
        ? Math.min(Math.floor(query.pageSize), MAX_PAGE_SIZE)
        : 10;

    const qb = this.accountRepo.createQueryBuilder('account');
    if (query.ownerId !== undefined) {
      qb.andWhere('account.ownerId = :ownerId', { ownerId: query.ownerId });
    }
    if (query.status !== undefined) {
      qb.andWhere('account.status = :status', { status: query.status });
    }
    if (query.keyword) {
      qb.andWhere('(account.name LIKE :kw OR account.accountNo LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }

    const [list, total] = await qb
      .orderBy('account.id', 'DESC')
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

  async findOne(id: number): Promise<Account> {
    const account = await this.accountRepo.findOneBy({ id });
    if (!account) {
      throw new NotFoundException(`账户 ${id} 不存在`);
    }
    return account;
  }

  /** 查询账户并做归属校验（本人或管理员） */
  async findOneFor(operator: AuthUser, id: number): Promise<Account> {
    const account = await this.findOne(id);
    this.assertAccess(account, operator);
    return account;
  }

  /** 账户可变字段白名单：仅名称与状态 */
  async update(id: number, dto: UpdateAccountDto) {
    const account = await this.findOne(id);

    if (dto.name !== undefined) account.name = dto.name;
    if (dto.status !== undefined) account.status = dto.status;

    return this.toView(await this.accountRepo.save(account));
  }

  /** 某用户名下所有账户 id，供流水查询做权限过滤 */
  async findIdsByOwner(ownerId: number): Promise<number[]> {
    const rows = await this.accountRepo.find({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** 非管理员只能操作自己的账户 */
  assertAccess(account: Account, operator: AuthUser): void {
    if (operator.roles.includes(Role.Admin)) return;
    if (account.ownerId !== operator.userId) {
      throw new ForbiddenException('无权操作该账户');
    }
  }

  toView(account: Account) {
    return {
      id: account.id,
      accountNo: account.accountNo,
      name: account.name,
      type: account.type,
      currency: account.currency,
      /** 余额（分） */
      balance: account.balance,
      /** 余额（元，仅展示用） */
      balanceYuan: centsToYuan(account.balance),
      status: account.status,
      ownerId: account.ownerId,
      createTime: account.createTime,
      updateTime: account.updateTime,
    };
  }

  private generateAccountNo(): string {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const random = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    return `AC${stamp}${random}`;
  }
}
