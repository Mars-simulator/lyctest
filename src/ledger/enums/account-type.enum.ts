/** 账户类型 */
export enum AccountType {
  /** 资产类：代表实际持有的资金 */
  Asset = 'asset',
  /** 负债类：代表应付/欠款类账户 */
  Liability = 'liability',
}

/** 账户状态 */
export enum AccountStatus {
  /** 正常，可收可付 */
  Normal = 1,
  /** 冻结，禁止出金（仍可入金） */
  Frozen = 0,
}
