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
      /**
       * Qui reçoit : une personne, ou un marchand.
       *
       * Déduit de la nature du compte destinataire, telle que le registre des comptes la déclare.
       * La nullité de `wallets.user_id` ne décide plus de rien.
       */
      type: 'p2p' | 'merchant'
      recipientPhone: string | null
      senderPhone: string
      senderAccountId: string
      recipientAccountId: string
      /** Soldes après mouvement. Le modèle `Transaction` ne les porte pas. */
      senderBalanceAfter: number
      recipientBalanceAfter: number
    }
  ) {
    super()
  }
}
