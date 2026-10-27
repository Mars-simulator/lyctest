import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../common/enums/role.enum.js';
import { AccountService } from './account.service.js';
import { Account } from './entities/account.entity.js';
import { AccountStatus, AccountType } from './enums/account-type.enum.js';

function createQueryBuilderMock() {
  return {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
}

const accountRepoMock = {
  create: jest.fn((input: Partial<Account>) => input),
  save: jest.fn(async (entity: Partial<Account>) => ({ id: 1, ...entity })),
  findOneBy: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const owner: AuthUser = { userId: 7, username: 'tom', roles: [Role.User] };
const admin: AuthUser = { userId: 1, username: 'admin', roles: [Role.Admin] };

describe('AccountService', () => {
  let service: AccountService;
  let qb: ReturnType<typeof createQueryBuilderMock>;

  beforeEach(async () => {
    jest.clearAllMocks();

    qb = createQueryBuilderMock();
    accountRepoMock.createQueryBuilder.mockReturnValue(qb);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: getRepositoryToken(Account), useValue: accountRepoMock },
      ],
    }).compile();

    service = moduleRef.get(AccountService);
  });

  describe('create', () => {
    it('新账户余额恒为 0，并生成账户号', async () => {
      const result = await service.create({ name: '现金账户' }, owner);

      const payload = accountRepoMock.create.mock.calls[0][0] as Partial<Account>;
      expect(payload.balance).toBe(0);
      expect(payload.accountNo).toMatch(/^AC\d{14}\d{6}$/);
      expect(payload.status).toBe(AccountStatus.Normal);
      expect(result.balanceYuan).toBe('0.00');
    });

    it('未指定 ownerId 时归属当前操作人', async () => {
      await service.create({ name: '现金账户' }, owner);

      const payload = accountRepoMock.create.mock.calls[0][0] as Partial<Account>;
      expect(payload.ownerId).toBe(owner.userId);
    });

    it('管理员可为他人开户', async () => {
      await service.create({ name: '代开账户', ownerId: 99 }, admin);

      const payload = accountRepoMock.create.mock.calls[0][0] as Partial<Account>;
      expect(payload.ownerId).toBe(99);
    });

    it('未指定类型与币种时使用默认值', async () => {
      await service.create({ name: '默认账户' }, owner);

      const payload = accountRepoMock.create.mock.calls[0][0] as Partial<Account>;
      expect(payload.type).toBe(AccountType.Asset);
      expect(payload.currency).toBe('CNY');
    });
  });

  describe('findPage', () => {
    it('pageSize 超上限时钳制为 100', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage({ page: 1, pageSize: 99999 });

      expect(qb.take).toHaveBeenCalledWith(100);
      expect(result.pageSize).toBe(100);
    });

    it('非法分页参数回落到默认值', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage({ page: 0, pageSize: Number.NaN });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('按 ownerId / status / 关键词构造参数化查询', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findPage({ page: 1, pageSize: 10, ownerId: 7, status: 1, keyword: '现金' });

      expect(qb.andWhere).toHaveBeenCalledWith('account.ownerId = :ownerId', { ownerId: 7 });
      expect(qb.andWhere).toHaveBeenCalledWith('account.status = :status', { status: 1 });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(account.name LIKE :kw OR account.accountNo LIKE :kw)',
        { kw: '%现金%' },
      );
    });
  });

  describe('findOne', () => {
    it('账户不存在时抛 NotFoundException', async () => {
      accountRepoMock.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOneFor（归属校验）', () => {
    it('本人可访问自己的账户', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({ id: 1, ownerId: owner.userId });

      await expect(service.findOneFor(owner, 1)).resolves.toMatchObject({ id: 1 });
    });

    it('管理员可访问任何账户', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({ id: 1, ownerId: 999 });

      await expect(service.findOneFor(admin, 1)).resolves.toMatchObject({ id: 1 });
    });

    it('普通用户访问他人账户抛 ForbiddenException（防越权 IDOR）', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({ id: 1, ownerId: 999 });

      await expect(service.findOneFor(owner, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('只更新名称与状态，余额不可通过该接口改动', async () => {
      const account = { id: 1, name: 'old', status: AccountStatus.Normal, balance: 100 };
      accountRepoMock.findOneBy.mockResolvedValue(account);

      // 试图夹带 balance 越权字段
      await service.update(1, { name: '新名称', balance: 999_999 } as never);

      expect(account.name).toBe('新名称');
      expect(account.balance).toBe(100);
    });

    it('可冻结账户', async () => {
      const account = { id: 1, name: 'a', status: AccountStatus.Normal, balance: 0 };
      accountRepoMock.findOneBy.mockResolvedValue(account);

      await service.update(1, { status: AccountStatus.Frozen });

      expect(account.status).toBe(AccountStatus.Frozen);
    });
  });

  describe('findIdsByOwner', () => {
    it('返回该用户名下所有账户 id', async () => {
      accountRepoMock.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await expect(service.findIdsByOwner(7)).resolves.toEqual([1, 2]);
    });
  });

  describe('validateForOperation（资金操作校验）', () => {
    it('deposit：本人账户通过校验', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({
        id: 1,
        accountNo: 'AC1',
        ownerId: owner.userId,
        status: AccountStatus.Normal,
      });

      await expect(service.validateForOperation(1, owner, 'deposit')).resolves.toMatchObject({
        id: 1,
      });
    });

    it('withdraw：冻结账户拒绝出金', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({
        id: 1,
        accountNo: 'AC1',
        ownerId: owner.userId,
        status: AccountStatus.Frozen,
      });

      await expect(service.validateForOperation(1, owner, 'withdraw')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('receive：收款方不校验归属，冻结账户仍拒绝', async () => {
      accountRepoMock.findOneBy.mockResolvedValue({
        id: 1,
        accountNo: 'AC1',
        ownerId: 999,
        status: AccountStatus.Normal,
      });

      await expect(service.validateForOperation(1, owner, 'receive')).resolves.toMatchObject({
        id: 1,
      });
    });
  });
});
