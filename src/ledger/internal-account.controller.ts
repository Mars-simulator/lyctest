import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import type { AccountAction } from './account-port.js';
import { AccountService } from './account.service.js';

/**
 * 账户服务对账务服务暴露的内部接口。
 *
 * 这些接口不标记 @Public()，账务服务调用时透传最终用户的 Authorization 头，
 * 账户服务用共享的 JWT_SECRET 验签后，以最终用户身份做归属/冻结校验。
 */
@Controller('internal/accounts')
export class InternalAccountController {
  constructor(private readonly accountService: AccountService) {}

  /** 校验账户可用于资金操作（存在 + 归属 + 按动作校验冻结），返回账户信息 */
  @Get(':id/validate')
  validate(
    @Param('id', ParseIntPipe) id: number,
    @Query('action') action: string = 'deposit',
    @CurrentUser() operator: AuthUser,
  ) {
    const normalized = this.normalizeAction(action);
    return this.accountService.validateForOperation(id, operator, normalized);
  }

  /** 某用户名下账户 id 列表（供账务服务流水权限过滤） */
  @Get('ids')
  async ids(@Query('ownerId', ParseIntPipe) ownerId: number, @CurrentUser() operator: AuthUser) {
    if (!operator.roles.includes(Role.Admin) && operator.userId !== ownerId) {
      throw new ForbiddenException('无权查询该用户的账户');
    }
    const ids = await this.accountService.findIdsByOwner(ownerId);
    return { ids };
  }

  private normalizeAction(action: string): AccountAction {
    if (action === 'withdraw' || action === 'receive') return action;
    return 'deposit';
  }
}
