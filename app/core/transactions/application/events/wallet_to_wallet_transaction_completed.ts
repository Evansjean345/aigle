import { BaseEvent } from '@adonisjs/core/events'
import type Transaction from '#core/transactions/domain/models/transaction'

export default class WalletToWalletTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(
    public senderTransaction: Transaction,
    public receiverTransaction: Transaction,
    public payload: {
      recipientPhone: string
      senderPhone: string
    }
  ) {
    super()
  }
}
