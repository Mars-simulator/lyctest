import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { AccountStatus } from '../enums/account-type.enum.js';

/** 账户可变字段白名单：名称与状态；余额只能通过资金操作变更 */
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @Length(1, 100, { message: '账户名称长度需为 1-100 位' })
  @Matches(/^[^<>]*$/, { message: '账户名称不能包含 < 或 > 字符' })
  name?: string;

  @IsOptional()
  @IsEnum(AccountStatus, { message: '状态只能是 1（正常）或 0（冻结）' })
  status?: AccountStatus;
}
