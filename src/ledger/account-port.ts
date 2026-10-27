import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import type { AccountType } from './enums/account-type.enum.js';

/** 资金操作时对账户的校验动作 */
export type AccountAction = 'deposit' | 'withdraw' | 'receive';

/** 账户网关返回给账务服务的账户信息快照 */
export interface AccountInfo {
  id: number;
  accountNo: string;
  name: string;
  type: AccountType;
  currency: string;
  status: number;
  ownerId: number;
}

/**
 * 账户访问抽象（服务间调用的关键接缝）。
 *
 * - 单体模式：由 LocalAccountPort 进程内直接调用 AccountService。
 * - 拆分模式：由 RemoteAccountClient 通过 HTTP 调用账户服务。
 *
 * 账务服务只依赖此抽象，从而在同一套 TransactionService 代码下，
 * 既可本地调用、也可跨容器调用账户服务。
 */
export abstract class AccountPort {
  /**
   * 校验账户可用于资金操作，返回账户信息快照。
   * @param action deposit=存在+归属；withdraw=存在+归属+未冻结；receive=存在+未冻结
   * @param authHeader 原始 Authorization 头（拆分模式下透传给账户服务验签）
   */
  abstract validateAccount(
    accountId: number,
    action: AccountAction,
    operator: AuthUser,
    authHeader?: string,
  ): Promise<AccountInfo>;

  /** 某用户名下账户 id 列表（流水查询做权限过滤） */
  abstract findIdsByOwner(ownerId: number, authHeader?: string): Promise<number[]>;
}
