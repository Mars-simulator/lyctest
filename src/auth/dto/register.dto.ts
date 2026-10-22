import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { stripControlChars } from '../../common/utils/sanitize.util.js';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @Length(3, 50, { message: '用户名长度需为 3-50 位' })
  @Matches(/^[A-Za-z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @Length(8, 64, { message: '密码长度需为 8-64 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: '密码需同时包含字母和数字' })
  password: string;

  @IsOptional()
  @IsString()
  @Length(1, 30, { message: '昵称长度需为 1-30 位' })
  // 拒绝标签字符，从源头切断存储型 XSS
  @Matches(/^[^<>]*$/, { message: '昵称不能包含 < 或 > 字符' })
  @Transform(({ value }) => (typeof value === 'string' ? stripControlChars(value) : value))
  nickname?: string;
}
