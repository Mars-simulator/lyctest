import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { AccountStatus, AccountType } from '../enums/account-type.enum.js';
import { bigintTransformer } from '../utils/money.util.js';

@Entity('ledger_account')
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  /** 对外展示的账户号，业务唯一 */
  @Index({ unique: true })
  @Column({ length: 32, comment: '账户号' })
  accountNo: string;

  @Column({ length: 100, comment: '账户名称' })
  name: string;

  @Column({ type: 'varchar', length: 20, default: AccountType.Asset, comment: '账户类型' })
  type: AccountType;

  @Column({ length: 3, default: 'CNY', comment: '币种' })
  currency: string;

  /** 余额（分）。仅允许通过资金操作服务修改，禁止直接赋值。 */
  @Column({ type: 'bigint', default: 0, transformer: bigintTransformer, comment: '余额（分）' })
  balance: number;

  @Column({ default: AccountStatus.Normal, comment: '状态 1正常 0冻结' })
  status: number;

  @Column({ comment: '归属用户 id' })
  ownerId: number;

  /** 乐观锁版本号，save 时 TypeORM 自动校验并递增 */
  @VersionColumn({ comment: '乐观锁版本' })
  version: number;

  @CreateDateColumn({ comment: '创建时间' })
  createTime: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updateTime: Date;
}
