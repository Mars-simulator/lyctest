// src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashPassword } from '../auth/utils/password.util.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

/** 创建用户入参，允许内部指定角色（默认 user） */
export type CreateUserInput = CreateUserDto & { roles?: string[] };

const MAX_PAGE_SIZE = 100;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // 1. 创建（密码加密后落库）
  async create(createUserDto: CreateUserInput) {
    // 显式挑字段，防止 mass assignment（例如客户端传入 id/roles 越权）
    const user = this.userRepository.create({
      username: createUserDto.username,
      password: await hashPassword(createUserDto.password),
      nickname: createUserDto.nickname,
      status: createUserDto.status,
      roles: createUserDto.roles ?? [Role.User],
    }); // 创建内存实例
    const saved = await this.userRepository.save(user); // 插入数据库
    return this.toSafeUser(saved);
  }

  // 2. 查询全部
  async findAll() {
    return await this.userRepository.find();
  }

  // 分页查询（常用）
  async findPage(page: number = 1, pageSize: number = 10) {
    // 兜底钳制：即使绕过 DTO 也不会出现 NaN 或超大分页拖垮数据库
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeSize =
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
        : 10;

    const [list, total] = await this.userRepository.findAndCount({
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      order: { createTime: 'DESC' },
    });
    return {
      list,
      total,
      page: safePage,
      pageSize: safeSize,
    };
  }

  // 3. 根据id查询单条
  async findOne(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`id=${id} 用户不存在`);
    }
    return user;
  }

  // 按用户名查询（不含密码），用于注册查重
  async findByUsername(username: string) {
    return await this.userRepository.findOneBy({ username });
  }

  // 按用户名查询并带出密码，仅用于登录校验
  // 使用 QueryBuilder 参数绑定（:username），不存在字符串拼接造成的 SQL 注入
  async findByUsernameWithPassword(username: string) {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();
  }

  // 4. 更新
  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    // 白名单更新，避免客户端越权修改 id / roles / createTime
    if (updateUserDto.username !== undefined) user.username = updateUserDto.username;
    if (updateUserDto.nickname !== undefined) user.nickname = updateUserDto.nickname;
    if (updateUserDto.status !== undefined) user.status = updateUserDto.status;
    if (updateUserDto.password) user.password = await hashPassword(updateUserDto.password);

    const saved = await this.userRepository.save(user);
    return this.toSafeUser(saved);
  }

  // 5. 删除（物理删除）
  async remove(id: number) {
    const user = await this.findOne(id);
    return await this.userRepository.remove(user);
  }

  // 软删除拓展：实体增加 @DeleteDateColumn() deleteAt，使用 softRemove

  /** 剔除密码等敏感字段，避免泄露 */
  private toSafeUser(user: User) {
    const { id, username, nickname, status, roles, createTime, updateTime } = user;
    return { id, username, nickname, status, roles, createTime, updateTime };
  }
}
