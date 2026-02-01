import { BaseEvent } from '@adonisjs/core/events'

export interface WalletToWalletTransactionFailedPayload {
  userId: string
  amount: number
  recipientPhone: string
  reference?: string
}

export default class WalletToWalletTransactionFailed extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public data: WalletToWalletTransactionFailedPayload) {
    super()
  }
}
