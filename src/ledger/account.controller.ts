import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { AccountService } from './account.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { QueryAccountDto } from './dto/query-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { centsToYuan } from './utils/money.util.js';

@Controller('ledger/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** 开户：仅管理员；余额恒为 0 */
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() operator: AuthUser) {
    return this.accountService.create(dto, operator);
  }

  /** 账户列表：仅管理员 */
  @Roles(Role.Admin)
  @Get()
  findPage(@Query() query: QueryAccountDto) {
    return this.accountService.findPage(query);
  }

  /** 余额查询：本人或管理员 */
  @Get(':id/balance')
  async balance(@Param('id', ParseIntPipe) id: number, @CurrentUser() operator: AuthUser) {
    const account = await this.accountService.findOneFor(operator, id);
    return {
      accountId: account.id,
      accountNo: account.accountNo,
      currency: account.currency,
      /** 余额（分） */
      balance: account.balance,
      /** 余额（元，仅展示用） */
      balanceYuan: centsToYuan(account.balance),
      updatedAt: account.updateTime,
    };
  }

  /** 账户详情：本人或管理员 */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() operator: AuthUser) {
    const account = await this.accountService.findOneFor(operator, id);
    return this.accountService.toView(account);
  }

  /** 变更名称 / 状态：仅管理员（余额不可直接修改） */
  @Roles(Role.Admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.accountService.update(id, dto);
  }
}
