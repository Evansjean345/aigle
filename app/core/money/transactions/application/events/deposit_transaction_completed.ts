import { BaseEvent } from '@adonisjs/core/events'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

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
  /** Nature du compte crédité. Optionnelle : une charge peut ne pas la porter. */
  ownerType?: AccountOwnerType
  /** Consumer uniquement (absent pour un checkout : le marchand n'a pas de user). */
  userId?: string | null
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
