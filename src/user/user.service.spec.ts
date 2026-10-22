import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../common/enums/role.enum.js';
import { User } from './entities/user.entity.js';
import { UserService } from './user.service.js';

/** 模拟 QueryBuilder 链式调用 */
function createQueryBuilderMock() {
  const builder = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };
  return builder;
}

function createRepositoryMock() {
  const builder = createQueryBuilderMock();
  return {
    create: jest.fn((input: Partial<User>) => input),
    save: jest.fn(async (entity: Partial<User>) => ({ id: 1, ...entity })),
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
    builder,
  };
}

describe('UserService', () => {
  let service: UserService;
  let repo: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repo = createRepositoryMock();

    const moduleRef = await Test.createTestingModule({
      providers: [UserService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = moduleRef.get(UserService);
  });

  describe('create', () => {
    it('密码哈希后落库，默认分配 user 角色', async () => {
      const result = await service.create({ username: 'tom', password: 'Passw0rd' });

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(payload.password).not.toBe('Passw0rd');
      expect(payload.roles).toEqual([Role.User]);
      expect(result.username).toBe('tom');
    });

    it('返回值中不包含密码', async () => {
      const result = await service.create({ username: 'tom', password: 'Passw0rd' });

      expect(result).not.toHaveProperty('password');
    });

    it('显式传入 roles 时不被覆盖（供内部初始化管理员使用）', async () => {
      await service.create({
        username: 'admin',
        password: 'Passw0rd',
        roles: [Role.Admin, Role.User],
      });

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload.roles).toEqual([Role.Admin, Role.User]);
    });

    it('忽略入参中多余的字段，防止越权写入（mass assignment）', async () => {
      const maliciousInput = { username: 'tom', password: 'Passw0rd', id: 999 };

      await service.create(maliciousInput);

      const payload = repo.create.mock.calls[0][0] as Partial<User>;
      expect(payload).not.toHaveProperty('id');
    });
  });

  describe('findPage', () => {
    it('pageSize 超上限时钳制为 100', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage(1, 99999);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 100,
        order: { createTime: 'DESC' },
      });
      expect(result.pageSize).toBe(100);
    });

    it('非法分页参数回落到默认值', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findPage(0, Number.NaN);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('正常分页按 (page - 1) * pageSize 计算 skip', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);

      const result = await service.findPage(3, 20);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.total).toBe(1);
      expect(result.page).toBe(3);
    });
  });

  describe('findOne', () => {
    it('用户不存在时抛 NotFoundException', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('用户存在时返回实体', async () => {
      repo.findOneBy.mockResolvedValue({ id: 42, username: 'tom' });

      await expect(service.findOne(42)).resolves.toEqual({ id: 42, username: 'tom' });
    });
  });

  describe('findByUsernameWithPassword', () => {
    it('使用参数绑定查询，不做 SQL 字符串拼接', async () => {
      repo.builder.getOne.mockResolvedValue(null);
      const injection = "tom' OR '1'='1";

      await service.findByUsernameWithPassword(injection);

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(repo.builder.where).toHaveBeenCalledWith('user.username = :username', {
        username: injection,
      });
    });
  });

  describe('update', () => {
    it('只更新白名单字段，忽略 roles 等越权字段', async () => {
      repo.findOneBy.mockResolvedValue({
        id: 1,
        username: 'tom',
        nickname: 'old',
        status: 1,
        roles: [Role.User],
      });
      const dtoWithEscalation = { nickname: 'new', roles: [Role.Admin] };

      await service.update(1, dtoWithEscalation);

      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.nickname).toBe('new');
      expect(saved.roles).toEqual([Role.User]);
    });

    it('传入 password 时重新哈希后再保存', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, username: 'tom' });

      await service.update(1, { password: 'NewPassw0rd' });

      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(saved.password).not.toBe('NewPassw0rd');
    });

    it('返回值中不包含密码', async () => {
      repo.findOneBy.mockResolvedValue({ id: 1, username: 'tom' });

      const result = await service.update(1, { nickname: 'x' });

      expect(result).not.toHaveProperty('password');
    });
  });

  describe('remove', () => {
    it('先确认用户存在，再执行删除', async () => {
      const user = { id: 1, username: 'tom' };
      repo.findOneBy.mockResolvedValue(user);
      repo.remove.mockResolvedValue(user);

      await service.remove(1);

      expect(repo.remove).toHaveBeenCalledWith(user);
    });
  });
});
