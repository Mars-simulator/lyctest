import { jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../common/enums/role.enum.js';
import { AccountService } from './account.service.js';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { AccountStatus } from './enums/account-type.enum.js';
import { TransactionService } from './transaction.service.js';

const accountRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const txnRepoMock = {
  findOneBy: jest.fn(),
  createQueryBuilder: jest.fn(),
};

/** 模拟事务内的 EntityManager */
const managerMock = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const dataSourceMock = { transaction: jest.fn() };

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    accountNo: 'AC001',
    name: '现金账户',
    ownerId: 7,
    balance: 1000,
    status: AccountStatus.Normal,
    currency: 'CNY',
    ...overrides,
  } as Account;
}

const owner: AuthUser = { userId: 7, username: 'tom', roles: [Role.User] };
const admin: AuthUser = { userId: 1, username: 'admin', roles: [Role.Admin] };

describe('TransactionService', () => {
  let service: TransactionService;
  let qb: ReturnType<typeof createQueryBuilderMock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    // manager.create 返回原始数据；save 区分单实体与数组
    managerMock.create.mockImplementation((_entity: unknown, data: unknown) => data);
    managerMock.save.mockImplementation(async (input: unknown) =>
      Array.isArray(input) ? input : { id: 1, ...(input as object) },
    );
    managerMock.findOneBy.mockResolvedValue(null);
    dataSourceMock.transaction.mockImplementation((work: (m: unknown) => unknown) =>
      work(managerMock),
    );

    qb = createQueryBuilderMock();
    txnRepoMock.createQueryBuilder.mockReturnValue(qb);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionService,
        // 使用真实的 AccountService，以便覆盖真实的归属校验逻辑
        AccountService,
        { provide: getRepositoryToken(Transaction), useValue: txnRepoMock },
        { provide: getRepositoryToken(Account), useValue: accountRepoMock },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(TransactionService);
  });

  describe('deposit（存入）', () => {
    it('余额增加，并记录变动后余额快照', async () => {
      const acc = account({ balance: 1000 });
      managerMock.findOne.mockResolvedValue(acc);

      const result = await service.deposit({ accountId: 1, amount: 500 }, owner);

      expect(acc.balance).toBe(1500);
      const savedTxn = managerMock.save.mock.calls[1][0] as Record<string, unknown>;
      expect(savedTxn).toMatchObject({
        type: 'deposit',
        amount: 500,
        fromAccountId: null,
        toAccountId: 1,
        fromBalanceAfter: null,
        toBalanceAfter: 1500,
        operatorId: owner.userId,
      });
      expect(result.amountYuan).toBe('5.00');
      expect(result.type).toBe('deposit');
    });

    it('相同 txnNo 重复提交不会重复入账', async () => {
      const existedTxn = { ...account(), id: 9, txnNo: 'DP-1', amount: 500 };
      managerMock.findOneBy.mockResolvedValue(existedTxn);

      const result = await service.deposit({ accountId: 1, amount: 500, txnNo: 'DP-1' }, owner);

      expect(result.id).toBe(9);
      expect(managerMock.save).not.toHaveBeenCalled();
      // 幂等命中后不应再加锁
      expect(managerMock.findOne).not.toHaveBeenCalled();
    });

    it('并发提交相同 txnNo 撞唯一索引时，回查并返回既有流水', async () => {
      dataSourceMock.transaction.mockRejectedValue(
        Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }),
      );
      txnRepoMock.findOneBy.mockResolvedValue({ id: 8, txnNo: 'DP-X', amount: 1 });

      const result = await service.deposit({ accountId: 1, amount: 1, txnNo: 'DP-X' }, owner);

      expect(result.id).toBe(8);
    });

    it('操作他人账户抛 ForbiddenException（防越权）', async () => {
      managerMock.findOne.mockResolvedValue(account({ ownerId: 999 }));

      await expect(service.deposit({ accountId: 1, amount: 100 }, owner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('账户不存在抛 NotFoundException', async () => {
      managerMock.findOne.mockResolvedValue(null);

      await expect(service.deposit({ accountId: 1, amount: 100 }, owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('withdraw（取出）', () => {
    it('余额减少', async () => {
      const acc = account({ balance: 1000 });
      managerMock.findOne.mockResolvedValue(acc);

      await service.withdraw({ accountId: 1, amount: 300 }, owner);

      expect(acc.balance).toBe(700);
      const savedTxn = managerMock.save.mock.calls[1][0] as Record<string, unknown>;
      expect(savedTxn).toMatchObject({
        type: 'withdraw',
        fromAccountId: 1,
        toAccountId: null,
        fromBalanceAfter: 700,
      });
    });

    it('余额不足时拒绝，且不写库', async () => {
      managerMock.findOne.mockResolvedValue(account({ balance: 100 }));

      await expect(
        service.withdraw({ accountId: 1, amount: 500 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('冻结账户禁止出金', async () => {
      managerMock.findOne.mockResolvedValue(
        account({ balance: 1000, status: AccountStatus.Frozen }),
      );

      await expect(
        service.withdraw({ accountId: 1, amount: 100 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(managerMock.save).not.toHaveBeenCalled();
    });
  });

  describe('transfer（转账）', () => {
    it('双方余额同时变更，快照分别记录', async () => {
      const from = account({ id: 1, balance: 1000 });
      const to = account({ id: 2, accountNo: 'AC002', ownerId: 999, balance: 200 });
      managerMock.find.mockResolvedValue([from, to]);

      await service.transfer({ fromAccountId: 1, toAccountId: 2, amount: 300 }, owner);

      expect(from.balance).toBe(700);
      expect(to.balance).toBe(500);
      const savedTxn = managerMock.save.mock.calls[1][0] as Record<string, unknown>;
      expect(savedTxn).toMatchObject({
        type: 'transfer',
        amount: 300,
        fromAccountId: 1,
        toAccountId: 2,
        fromBalanceAfter: 700,
        toBalanceAfter: 500,
      });
    });

    it('使用悲观写锁按 id 集合加锁，避免并发死锁', async () => {
      managerMock.find.mockResolvedValue([account({ id: 1 }), account({ id: 2 })]);

      await service.transfer({ fromAccountId: 2, toAccountId: 1, amount: 100 }, owner);

      expect(managerMock.find).toHaveBeenCalledWith(
        Account,
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
    });

    it('转出与转入账户相同直接拒绝', async () => {
      await expect(
        service.transfer({ fromAccountId: 1, toAccountId: 1, amount: 100 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('余额不足时拒绝', async () => {
      managerMock.find.mockResolvedValue([
        account({ id: 1, balance: 100 }),
        account({ id: 2, ownerId: 999 }),
      ]);

      await expect(
        service.transfer({ fromAccountId: 1, toAccountId: 2, amount: 500 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('币种不一致时拒绝', async () => {
      managerMock.find.mockResolvedValue([
        account({ id: 1, currency: 'CNY' }),
        account({ id: 2, ownerId: 999, currency: 'USD' }),
      ]);

      await expect(
        service.transfer({ fromAccountId: 1, toAccountId: 2, amount: 100 }, owner),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('账户缺失时抛 NotFoundException', async () => {
      managerMock.find.mockResolvedValue([account({ id: 1 })]);

      await expect(
        service.transfer({ fromAccountId: 1, toAccountId: 2, amount: 100 }, owner),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('非本人账户不可作为转出方', async () => {
      managerMock.find.mockResolvedValue([
        account({ id: 1, ownerId: 999 }),
        account({ id: 2, ownerId: 999 }),
      ]);

      await expect(
        service.transfer({ fromAccountId: 1, toAccountId: 2, amount: 100 }, owner),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('findPage（流水查询）', () => {
    it('管理员查询不做归属过滤', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPage({ page: 1, pageSize: 10 }, admin);

      expect(accountRepoMock.find).not.toHaveBeenCalled();
    });

    it('普通用户未持有账户时直接返回空结果', async () => {
      accountRepoMock.find.mockResolvedValue([]);

      const result = await service.findPage({ page: 1, pageSize: 10 }, owner);

      expect(result).toEqual({ list: [], total: 0, page: 1, pageSize: 10 });
      // 直接短路返回，不执行任何数据库查询
      expect(qb.getManyAndCount).not.toHaveBeenCalled();
    });

    it('普通用户查询他人账户流水抛 ForbiddenException', async () => {
      accountRepoMock.find.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.findPage({ page: 1, pageSize: 10, accountId: 99 }, owner),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('普通用户查询自己账户时按转出/转入双向过滤', async () => {
      accountRepoMock.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPage({ page: 1, pageSize: 10 }, owner);

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(txn.fromAccountId IN (:...ownedIds) OR txn.toAccountId IN (:...ownedIds))',
        { ownedIds: [1, 2] },
      );
    });

    it('时间区间与类型使用参数绑定过滤', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPage(
        {
          page: 1,
          pageSize: 10,
          type: 'transfer' as never,
          startTime: '2026-01-01T00:00:00.000Z',
          endTime: '2026-12-31T23:59:59.000Z',
        },
        admin,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('txn.type = :type', { type: 'transfer' });
      expect(qb.andWhere).toHaveBeenCalledWith('txn.createTime >= :startTime', {
        startTime: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(qb.andWhere).toHaveBeenCalledWith('txn.createTime <= :endTime', {
        endTime: new Date('2026-12-31T23:59:59.000Z'),
      });
    });
  });

  describe('findByTxnNo（按流水号查询）', () => {
    it('流水不存在抛 NotFoundException', async () => {
      txnRepoMock.findOneBy.mockResolvedValue(null);

      await expect(service.findByTxnNo('NOT_EXIST', owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('与本人账户无关的流水抛 ForbiddenException', async () => {
      txnRepoMock.findOneBy.mockResolvedValue({
        id: 1,
        txnNo: 'TF-1',
        fromAccountId: 100,
        toAccountId: 200,
        amount: 1,
      });
      accountRepoMock.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.findByTxnNo('TF-1', owner)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('本人账户相关的流水可查询', async () => {
      txnRepoMock.findOneBy.mockResolvedValue({
        id: 1,
        txnNo: 'TF-1',
        type: 'transfer',
        amount: 100,
        fromAccountId: 1,
        toAccountId: 200,
        fromBalanceAfter: 0,
        toBalanceAfter: 100,
        status: 'success',
        remark: null,
        operatorId: 7,
        createTime: new Date(),
      });
      accountRepoMock.find.mockResolvedValue([{ id: 1 }]);

      await expect(service.findByTxnNo('TF-1', owner)).resolves.toMatchObject({ txnNo: 'TF-1' });
    });
  });
});
