import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { CreateProductDto } from './create-product.dto.js';

/** name / price 可选；id 必填且必须是正整数 */
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @Type(() => Number)
  @IsInt({ message: 'id 必须是整数' })
  @Min(1, { message: 'id 必须大于 0' })
  id: number;
}
