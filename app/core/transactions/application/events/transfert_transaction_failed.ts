import { BaseEvent } from '@adonisjs/core/events'

export interface TransfertTransactionFailedPayload {
  reference: string
  amount: number
  userId: string
  beneficiaryPhone: string
}

export default class TransfertTransactionFailed extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: TransfertTransactionFailedPayload) {
    super()
  }
}
