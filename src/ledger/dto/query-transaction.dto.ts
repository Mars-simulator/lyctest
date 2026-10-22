import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { TransactionType } from '../enums/transaction-type.enum.js';

export class QueryTransactionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须是整数' })
  @Min(1, { message: 'page 最小为 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须是整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  @Max(100, { message: 'pageSize 最大为 100' })
  pageSize: number = 10;

  /** 只查该账户相关的流水（作为转出方或转入方） */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'accountId 必须是整数' })
  @Min(1)
  accountId?: number;

  @IsOptional()
  @IsEnum(TransactionType, { message: 'type 必须是 deposit/withdraw/transfer' })
  type?: TransactionType;

  @IsOptional()
  @IsISO8601({}, { message: 'startTime 需为 ISO8601 时间格式' })
  startTime?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endTime 需为 ISO8601 时间格式' })
  endTime?: string;
}
