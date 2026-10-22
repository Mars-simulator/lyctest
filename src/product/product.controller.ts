import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductService } from './product.service.js';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // 查询：已登录即可；id 经 ParseIntPipe 校验，非法值直接 400，不会进入 SQL
  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    const data = await this.productService.getProductById(id);
    return { code: 0, data };
  }

  // 新增/修改：仅管理员
  @Roles(Role.Admin)
  @Put()
  async update(@Body() dto: UpdateProductDto) {
    const ok = await this.productService.updateProduct(dto);
    return { code: 0, success: ok };
  }

  @Roles(Role.Admin)
  @Post()
  async add(@Body() dto: CreateProductDto) {
    const newId = await this.productService.addProduct(dto);
    return { code: 0, id: newId };
  }
}
