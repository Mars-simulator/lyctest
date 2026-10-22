import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Length, Matches, Min } from 'class-validator';
import { stripControlChars } from '../../common/utils/sanitize.util.js';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: '商品名不能为空' })
  @Length(1, 100, { message: '商品名长度需为 1-100 位' })
  // 拒绝标签字符，从源头切断存储型 XSS
  @Matches(/^[^<>]*$/, { message: '商品名不能包含 < 或 > 字符' })
  @Transform(({ value }) => (typeof value === 'string' ? stripControlChars(value) : value))
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '价格必须是最多两位小数的数字' })
  @Min(0, { message: '价格不能为负数' })
  price: number;
}
