import TransactionLogEntry from '#core/transactions/domain/models/transaction_log_entry'
import { type TransactionLogEventData } from '#core/transactions/application/types/transaction_log_event_data'

class TransactionLogService {
  /**
   * Processes the given transaction log event data and creates a corresponding log entry.
   *
   * @param {TransactionLogEventData} data - The transaction log event data to be processed.
   * @return {Promise<void>} A promise that resolves when the transaction log entry has been successfully created.
   */
  async handle(data: TransactionLogEventData): Promise<void> {
    const entry = this.build(data)
    await TransactionLogEntry.create(entry)
  }

  /**
   * Constructs and returns a transaction log event object based on the provided event data.
   *
   * @param data - The data describing the transaction log event.
   * @private
   */
  private build(data: TransactionLogEventData) {
    switch (data.event) {
      case 'CREATED':
        return {
          transactionId: data.transactionId,
          eventType: 'CREATED',
          status: 'PENDING',
          payload: {
            amount: data.amount,
            fees: data.fees,
            total: data.total,
            provider: data.provider,
            paymentMethod: data.paymentMethod,
            transactionType: data.transactionType,
          },
          actorId: data.actorId,
          actorType: 'USER' as const,
          ipAddress: data.ipAddress,
        }

      case 'WALLET_DEBITED':
        return {
          transactionId: data.transactionId,
          eventType: 'WALLET_DEBITED',
          status: 'PROCESSING',
          payload: {
            walletId: data.walletId,
            amount: data.amount,
            balanceBefore: data.balanceBefore,
            balanceAfter: data.balanceAfter,
          },
          actorType: 'SYSTEM' as const,
        }

      case 'WALLET_CREDITED':
        return {
          transactionId: data.transactionId,
          eventType: 'WALLET_CREDITED',
          status: 'PROCESSING',
          payload: {
            walletId: data.walletId,
            amount: data.amount,
            balanceBefore: data.balanceBefore,
            balanceAfter: data.balanceAfter,
          },
          actorType: 'SYSTEM' as const,
        }

      case 'SENT_TO_AGGREGATOR':
        return {
          transactionId: data.transactionId,
          eventType: 'SENT_TO_AGGREGATOR',
          status: 'PROCESSING',
          payload: {
            provider: data.provider,
            reference: data.reference,
            ...(data.operation ? { operation: data.operation } : {}),
            ...(data.rawRequest ? { rawRequest: data.rawRequest } : {}),
          },
          actorType: 'SYSTEM' as const,
        }

      case 'WEBHOOK_RECEIVED':
        return {
          transactionId: data.reference,
          eventType: 'WEBHOOK_RECEIVED',
          status: 'PROCESSING',
          payload: data.webhookPayload,
          actorType: 'SYSTEM' as const,
          ipAddress: data.ipAddress,
        }

      case 'SUCCESS':
        return {
          transactionId: data.transactionId,
          eventType: 'SUCCESS',
          status: 'SUCCESS',
          actorType: 'SYSTEM' as const,
        }

      case 'FAILED':
        return {
          transactionId: data.transactionId,
          eventType: 'FAILED',
          status: 'FAILED',
          errorMessage: data.errorMessage,
          actorType: 'SYSTEM' as const,
        }

      case 'RETRY':
        return {
          transactionId: data.transactionId,
          eventType: 'RETRY',
          status: 'PROCESSING',
          payload: { attempt: data.attempt },
          actorType: 'SYSTEM' as const,
        }

      case 'REFUND':
        return {
          transactionId: data.transactionId,
          eventType: 'REFUND',
          status: 'REFUNDED',
          payload: { amount: data.amount },
          actorType: 'SYSTEM' as const,
        }

      case 'CANCELLED':
        return {
          transactionId: data.transactionId,
          eventType: 'CANCELLED',
          status: 'CANCELLED',
          actorType: 'SYSTEM' as const,
        }

      case 'LEDGER_ENTRY_CREATED':
        return {
          transactionId: data.transactionId,
          eventType: 'LEDGER_ENTRY_CREATED',
          status: 'COMPLETED',
          payload: {
            walletId: data.walletId,
            direction: data.direction,
            amountBrut: data.amountBrut,
            fees: data.fees,
            totalAmount: data.totalAmount,
            balanceBefore: data.balanceBefore,
            balanceAfter: data.balanceAfter,
            operationType: data.operationType,
          },
          actorType: 'SYSTEM' as const,
        }

      case 'VALIDATION_PASSED':
        return {
          transactionId: data.transactionId,
          eventType: 'VALIDATION_PASSED',
          status: 'PENDING',
          payload: { checks: data.checks },
          actorId: data.actorId,
          actorType: 'SYSTEM' as const,
        }

      case 'FEES_CALCULATED':
        return {
          transactionId: data.transactionId,
          eventType: 'FEES_CALCULATED',
          status: 'PENDING',
          payload: {
            amount: data.amount,
            fees: data.fees,
            total: data.total,
          },
          actorType: 'SYSTEM' as const,
        }

      case 'AGGREGATOR_RESPONSE_RECEIVED':
        return {
          transactionId: data.transactionId,
          eventType: 'AGGREGATOR_RESPONSE_RECEIVED',
          status: 'PROCESSING',
          payload: {
            provider: data.provider,
            success: data.success,
            ...(data.operation ? { operation: data.operation } : {}),
            ...(data.rawResponse ? { rawResponse: data.rawResponse } : {}),
          },
          errorMessage: data.errorMessage,
          actorType: 'SYSTEM' as const,
        }
    }
  }
}

const transactionLogService = new TransactionLogService()
export default transactionLogService
