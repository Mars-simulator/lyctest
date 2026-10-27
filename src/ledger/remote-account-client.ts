import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/jwt-payload.interface.js';
import { AccountPort, type AccountAction, type AccountInfo } from './account-port.js';

/**
 * 拆分模式实现：通过 HTTP 调用账户服务的内部接口。
 *
 * 鉴权策略：透传原始 Authorization 头，账户服务用同一 JWT_SECRET 验签，
 * 从而以「最终用户」身份完成归属/冻结校验，避免服务间另行约定凭证。
 */
@Injectable()
export class RemoteAccountClient extends AccountPort {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async validateAccount(
    accountId: number,
    action: AccountAction,
    _operator: AuthUser,
    authHeader?: string,
  ): Promise<AccountInfo> {
    const res = await fetch(
      `${this.baseUrl}/internal/accounts/${accountId}/validate?action=${action}`,
      { headers: authHeader ? { Authorization: authHeader } : {} },
    );
    return this.unwrap<AccountInfo>(res);
  }

  async findIdsByOwner(ownerId: number, authHeader?: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/internal/accounts/ids?ownerId=${ownerId}`, {
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const body = await this.unwrap<{ ids: number[] }>(res);
    return body.ids;
  }

  /** 把账户服务的响应解包，并把其错误状态码映射为本地对应异常 */
  private async unwrap<T>(res: Response): Promise<T> {
    if (res.ok) return (await res.json()) as T;

    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join('; ')
      : (body?.message ?? `账户服务返回 ${res.status}`);

    if (res.status === 404) throw new NotFoundException(message);
    if (res.status === 403) throw new ForbiddenException(message);
    if (res.status === 400) throw new BadRequestException(message);
    throw new ServiceUnavailableException(`账户服务不可用（${res.status}）：${message}`);
  }
}
