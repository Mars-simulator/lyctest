import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionStatus, TransactionType } from '../enums/transaction-type.enum.js';
import { bigintTransformer } from '../utils/money.util.js';

/**
 * 资金流水。
 *
 * 采用统一的「资金流向」模型表达三类业务：
 * - 存入：fromAccountId = null，toAccountId = 账户
 * - 取出：fromAccountId = 账户，toAccountId = null
 * - 转账：fromAccountId / toAccountId 均为账户
 *
 * 每笔流水都记录变动后的余额快照，便于对账与排查。
 */
@Entity('ledger_transaction')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  /** 业务流水号，同时作为幂等键（唯一约束） */
  @Index({ unique: true })
  @Column({ length: 64, comment: '业务流水号（幂等键）' })
  txnNo: string;

  @Column({ type: 'varchar', length: 20, comment: '交易类型 deposit/withdraw/transfer' })
  type: TransactionType;

  @Column({ type: 'bigint', transformer: bigintTransformer, comment: '金额（分，恒为正数）' })
  amount: number;

  // 注意：可空列的联合类型经反射为 Object，必须显式声明 type，否则 TypeORM 报 DataTypeNotSupportedError
  @Column({ type: 'int', nullable: true, comment: '转出账户 id（为空表示外部）' })
  fromAccountId: number | null;

  @Column({ type: 'int', nullable: true, comment: '转入账户 id（为空表示外部）' })
  toAccountId: number | null;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
    nullable: true,
    comment: '转出账户变动后余额（分）',
  })
  fromBalanceAfter: number | null;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
    nullable: true,
    comment: '转入账户变动后余额（分）',
  })
  toBalanceAfter: number | null;

  @Column({ type: 'varchar', length: 20, default: TransactionStatus.Success, comment: '状态' })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '备注' })
  remark: string | null;

  @Index()
  @Column({ comment: '操作人 id' })
  operatorId: number;

  @Index()
  @CreateDateColumn({ comment: '创建时间' })
  createTime: Date;
}
