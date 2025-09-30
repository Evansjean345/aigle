import { BaseEvent } from '@adonisjs/core/events'
import Transaction from '#shared/models/transaction'

export default class WalletToWalletTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(
    public senderTransaction: Transaction,
    public receiverTransaction: Transaction,
    public payload: {
      recipienPhone: string
      senderPhone: string
    }
  ) {
    console.log('event listener started')
    console.log(payload)
    super()
  }
}
