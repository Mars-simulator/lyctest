import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { MAX_AMOUNT_CENTS } from '../utils/money.util.js';

export class TransferDto {
  @Type(() => Number)
  @IsInt({ message: 'fromAccountId 必须是整数' })
  @Min(1, { message: 'fromAccountId 必须大于 0' })
  fromAccountId: number;

  @Type(() => Number)
  @IsInt({ message: 'toAccountId 必须是整数' })
  @Min(1, { message: 'toAccountId 必须大于 0' })
  toAccountId: number;

  /** 金额单位：分 */
  @Type(() => Number)
  @IsInt({ message: '金额必须是整数（单位：分）' })
  @Min(1, { message: '金额必须大于 0' })
  @Max(MAX_AMOUNT_CENTS, { message: '单笔金额超出上限' })
  amount: number;

  /** 幂等键：同一 txnNo 重复提交只会转账一次 */
  @IsOptional()
  @IsString()
  @Length(1, 64, { message: 'txnNo 长度需为 1-64 位' })
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'txnNo 只能包含字母、数字、下划线与中划线' })
  txnNo?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255, { message: '备注长度需为 1-255 位' })
  @Matches(/^[^<>]*$/, { message: '备注不能包含 < 或 > 字符' })
  remark?: string;
}
