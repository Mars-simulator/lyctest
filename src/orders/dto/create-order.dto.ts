import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'userId 不能为空' })
  userId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount 必须是数字，最多两位小数' })
  @Min(0.01, { message: 'amount 必须大于 0' })
  amount: number;

  /** 仅用于演示日志脱敏（redact），不参与业务逻辑 */
  @IsOptional()
  @IsString()
  password?: string;
}
