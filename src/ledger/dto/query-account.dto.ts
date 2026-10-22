import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class QueryAccountDto {
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

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ownerId 必须是整数' })
  @Min(1)
  ownerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'status 必须是整数' })
  status?: number;

  @IsOptional()
  @IsString()
  @Length(1, 100, { message: '关键词长度需为 1-100 位' })
  keyword?: string;
}
