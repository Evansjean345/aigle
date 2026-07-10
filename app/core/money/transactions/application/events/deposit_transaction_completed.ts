import { BaseEvent } from '@adonisjs/core/events'

export interface DepositTransactionCompletedPayload {
  reference: string
  /**
   * Discriminateur : `deposit` (consumer, crédit du wallet user) ou `checkout` (encaissement
   * marchand, compte org sans user). Les listeners s'abonnent au même event et **filtrent sur
   * ce flag** — chacun n'agit que pour le type qui le concerne.
   */
  type: 'deposit' | 'checkout'
  amount: number
  /** Compte crédité (`account_id`). Pour un consumer, == userId. */
  accountId: string
  /** Consumer uniquement (absent pour un checkout : le marchand n'a pas de user). */
  userId?: string
  /** Consumer uniquement. */
  balanceAfter?: number
}

export default class DepositTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: DepositTransactionCompletedPayload) {
    super()
  }
}
