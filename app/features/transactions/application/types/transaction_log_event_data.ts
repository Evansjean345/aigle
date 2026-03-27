export type TransactionLogEvent =
  | 'CREATED'
  | 'VALIDATION_PASSED'
  | 'FEES_CALCULATED'
  | 'WALLET_DEBITED'
  | 'WALLET_CREDITED'
  | 'SENT_TO_AGGREGATOR'
  | 'AGGREGATOR_RESPONSE_RECEIVED'
  | 'WEBHOOK_RECEIVED'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY'
  | 'REFUND'
  | 'CANCELLED'
  | 'LEDGER_ENTRY_CREATED'

export type TransactionLogEventData =
  | {
      event: 'CREATED'
      transactionId: string
      amount: number
      fees: number
      total: number
      provider: string
      paymentMethod: string
      transactionType: string
      actorId: string
      ipAddress?: string | null
    }
  | {
      event: 'WALLET_DEBITED'
      transactionId: string
      walletId: string
      amount: number
      balanceBefore: number
      balanceAfter: number
    }
  | {
      event: 'WALLET_CREDITED'
      transactionId: string
      walletId: string
      amount: number
      balanceBefore: number
      balanceAfter: number
    }
  | { event: 'SENT_TO_AGGREGATOR'; transactionId: string; provider: string; reference: string }
  | {
      event: 'WEBHOOK_RECEIVED'
      reference: string
      webhookPayload: Record<string, unknown>
      ipAddress?: string | null
    }
  | { event: 'SUCCESS'; transactionId: string }
  | { event: 'FAILED'; transactionId: string; errorMessage: string }
  | { event: 'RETRY'; transactionId: string; attempt: number }
  | { event: 'REFUND'; transactionId: string; amount: number }
  | { event: 'CANCELLED'; transactionId: string }
  | {
      event: 'VALIDATION_PASSED'
      transactionId: string
      checks: string[]
      actorId: string
    }
  | {
      event: 'FEES_CALCULATED'
      transactionId: string
      amount: number
      fees: number
      total: number
    }
  | {
      event: 'AGGREGATOR_RESPONSE_RECEIVED'
      transactionId: string
      provider: string
      success: boolean
      errorMessage?: string
    }
  | {
      event: 'LEDGER_ENTRY_CREATED'
      transactionId: string
      walletId: string
      direction: string
      amountBrut: number
      fees: number
      totalAmount: number
      balanceBefore: number
      balanceAfter: number
      operationType: string
    }
