import { BaseEvent } from '@adonisjs/core/events'

export interface TransfertTransactionCompletedPayload {
  reference: string
  balanceAfter: number
  amount: number
  /** Compte émetteur (`account_id`). Pour un user == usersUid ; pour un **payout** org, l'org. */
  accountId: string
  /** Émetteur user (null pour un compte org sans user, ex. payout). */
  userId: string
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
