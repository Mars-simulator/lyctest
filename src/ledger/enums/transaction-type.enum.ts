/** 交易类型 */
export enum TransactionType {
  /** 存入：资金由外部流入账户 */
  Deposit = 'deposit',
  /** 取出：资金由账户流向外部 */
  Withdraw = 'withdraw',
  /** 转账：账户之间划转 */
  Transfer = 'transfer',
}

/** 交易状态 */
export enum TransactionStatus {
  Success = 'success',
  Failed = 'failed',
  /** 已冲正 */
  Reversed = 'reversed',
}
