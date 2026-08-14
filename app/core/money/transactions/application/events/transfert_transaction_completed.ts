import { BaseEvent } from '@adonisjs/core/events'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

export interface TransfertTransactionCompletedPayload {
  reference: string
  balanceAfter: number
  amount: number
  /** Compte émetteur (`account_id`). Pour un user == usersUid ; pour un **payout** org, l'org. */
  accountId: string
  /** Nature du compte émetteur. Optionnelle : une charge peut ne pas la porter. */
  ownerType?: AccountOwnerType
  /** Émetteur : renseigné pour une personne, nul pour une organisation. */
  userId?: string | null
  beneficiaryPhone: string
}

export default class TransfertTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: TransfertTransactionCompletedPayload) {
    super()
  }
}
