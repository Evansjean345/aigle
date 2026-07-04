import { BaseEvent } from '@adonisjs/core/events'

export interface TransfertInterTransactionFailedPayload {
  reference: string
  amount: number
  userId: string
  beneficiaryPhone: string
}

export default class TransfertInterTransactionFailed extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: TransfertInterTransactionFailedPayload) {
    super()
  }
}
