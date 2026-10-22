// src/user/entities/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../common/enums/role.enum.js';

// simple-array 在 MySQL 下映射为 text，而 text 列不允许有默认值；
// 这里改用 varchar + transformer，既能有默认值，又保持实体为 string[]
const rolesTransformer = {
  to: (roles: string[] | string | null) => (Array.isArray(roles) ? roles.join(',') : (roles ?? '')),
  from: (value: string[] | string | null) =>
    Array.isArray(value) ? value : value ? value.split(',') : [],
};

@Entity('sys_user') // 数据库表名 sys_user
export class User {
  // 自增主键
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, comment: '用户名' })
  username: string;

  // select: false —— 查询默认不返回密码；登录时用 QueryBuilder addSelect 显式取出
  // scrypt 密文形如 `salt:hash`（约 161 字符），故长度给到 255
  @Column({ length: 255, select: false, comment: '密码（scrypt 加密）' })
  password: string;

  // RBAC 角色，以逗号分隔存储，例如 "admin,user"
  @Column({
    type: 'varchar',
    length: 255,
    default: Role.User,
    transformer: rolesTransformer,
    comment: '角色，逗号分隔',
  })
  roles: string[];

  @Column({ length: 30, nullable: true, comment: '昵称' })
  nickname: string;

  @Column({ default: 1, comment: '状态 1启用 0禁用' })
  status: number;

  // 自动创建时间
  @CreateDateColumn({ comment: '创建时间' })
  createTime: Date;

  // 自动更新时间
  @UpdateDateColumn({ comment: '更新时间' })
  updateTime: Date;
}
