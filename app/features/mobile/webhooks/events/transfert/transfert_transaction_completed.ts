import { BaseEvent } from '@adonisjs/core/events'

export interface TransfertTransactionCompletedPayload {
  reference: string
  balanceAfter: number
  amount: number
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
