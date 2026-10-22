import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min } from 'class-validator';
import { AccountType } from '../enums/account-type.enum.js';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty({ message: '账户名称不能为空' })
  @Length(1, 100, { message: '账户名称长度需为 1-100 位' })
  @Matches(/^[^<>]*$/, { message: '账户名称不能包含 < 或 > 字符' })
  name: string;

  @IsOptional()
  @IsEnum(AccountType, { message: '账户类型必须是 asset 或 liability' })
  type?: AccountType;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: '币种需为 3 位大写字母，如 CNY' })
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ownerId 必须是整数' })
  @Min(1, { message: 'ownerId 必须大于 0' })
  ownerId?: number;
}
