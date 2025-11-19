import { BaseEvent } from '@adonisjs/core/events'

export interface DepositTransactionFailedPayload {
  reference: string
  balanceAfter: number
  amount: number
  userId: string
}

export default class DepositTransactionFailed extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: DepositTransactionFailedPayload) {
    super()
  }
}
