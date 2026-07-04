import { BaseEvent } from '@adonisjs/core/events'

export interface DepositTransactionCompletedPayload {
  reference: string
  balanceAfter: number
  amount: number
  userId: string
}

export default class DepositTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: DepositTransactionCompletedPayload) {
    super()
  }
}
