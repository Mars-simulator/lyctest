import { SetMetadata } from '@nestjs/common';

/** 标记路由为公开，跳过 JWT 认证守卫 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
