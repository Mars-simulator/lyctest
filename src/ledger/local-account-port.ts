import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { AccountPort, type AccountAction, type AccountInfo } from './account-port.js';
import { AccountService } from './account.service.js';
import type { Account } from './entities/account.entity.js';

/** 单体模式实现：进程内直接调用账户服务（无网络开销） */
@Injectable()
export class LocalAccountPort extends AccountPort {
  constructor(private readonly accountService: AccountService) {
    super();
  }

  async validateAccount(
    accountId: number,
    action: AccountAction,
    operator: AuthUser,
    _authHeader?: string,
  ): Promise<AccountInfo> {
    const account = await this.accountService.validateForOperation(accountId, operator, action);
    return this.toInfo(account);
  }

  async findIdsByOwner(ownerId: number, _authHeader?: string): Promise<number[]> {
    return this.accountService.findIdsByOwner(ownerId);
  }

  private toInfo(account: Account): AccountInfo {
    return {
      id: account.id,
      accountNo: account.accountNo,
      name: account.name,
      type: account.type,
      currency: account.currency,
      status: account.status,
      ownerId: account.ownerId,
    };
  }
}
