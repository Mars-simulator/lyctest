import type { ValueTransformer } from 'typeorm';

/**
 * 金额约定：所有金额以「最小货币单位（分）」的整数存储与传输，杜绝浮点误差。
 *
 * MySQL 的 BIGINT 由驱动以字符串返回，这里统一转换为 number。
 * number 的安全整数上限为 2^53-1，以分为单位约合 90 万亿元，满足业务需要。
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value ?? null,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** 字符串金额 → 分（用于需要支持小数的外部输入） */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/** 分 → 元字符串（两位小数，仅用于展示） */
export function centsToYuan(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 单笔金额上限（分）：1 亿元，防止误输天文数字 */
export const MAX_AMOUNT_CENTS = 100_000_000_00;
