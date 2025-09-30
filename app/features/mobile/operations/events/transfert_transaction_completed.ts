import { BaseEvent } from '@adonisjs/core/events'
import Transaction from '#shared/models/transaction'

export default class TransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public transaction: Transaction) {
    super()
  }
}
