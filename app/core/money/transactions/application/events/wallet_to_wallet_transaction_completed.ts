import { BaseEvent } from '@adonisjs/core/events'
import type Transaction from '#core/money/transactions/domain/models/transaction'

export default class WalletToWalletTransactionCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(
    public senderTransaction: Transaction,
    public receiverTransaction: Transaction,
    public payload: {
      type: 'p2p' | 'merchant'
      recipientPhone: string | null
      senderPhone: string
      recipientAccountId: string
      /** Soldes réels **après** mouvement (le modèle `Transaction` ne les porte pas — cf. R9). */
      senderBalanceAfter: number
      recipientBalanceAfter: number
    }
  ) {
    super()
  }
}
