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
  | {
      event: 'SENT_TO_AGGREGATOR'
      transactionId: string
      provider: string
      reference: string
      operation?: string
      /** Snapshot brut de la requête envoyée au provider (redactée). */
      rawRequest?: Record<string, unknown>
    }
  | {
      event: 'WEBHOOK_RECEIVED'
      reference: string
      webhookPayload: Record<string, unknown>
      ipAddress?: string | null
    }
  | { event: 'SUCCESS'; transactionId: string }
  | { event: 'FAILED'; transactionId: string; errorMessage: string }
  | { event: 'RETRY'; transactionId: string; attempt: number }
  | {
      event: 'REFUND'
      transactionId: string
      amount: number
      walletId?: string
      balanceBefore?: number
      balanceAfter?: number
      refundType?: string
      refundReason?: string
      adminId?: number | null
    }
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
      operation?: string
      /** Réponse brute du provider (succès ou corps d'erreur, redactée). */
      rawResponse?: Record<string, unknown>
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
