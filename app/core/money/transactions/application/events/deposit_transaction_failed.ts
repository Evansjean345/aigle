import { BaseEvent } from '@adonisjs/core/events'

export interface DepositTransactionFailedPayload {
  reference: string
  /** Discriminateur `deposit` | `checkout` — les listeners filtrent sur ce flag. */
  type: 'deposit' | 'checkout'
  amount: number
  /** Compte concerné (`account_id`). Pour un consumer, == userId. */
  accountId: string
  /** Consumer uniquement (absent pour un checkout). */
  userId?: string
  /** Consumer uniquement. */
  balanceAfter?: number
}

export default class DepositTransactionFailed extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: DepositTransactionFailedPayload) {
    super()
  }
}
