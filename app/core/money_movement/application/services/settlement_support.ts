import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#core/transactions/domain/models/transaction'
import type Payment from '#core/transactions/domain/models/payment'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#core/transactions/domain/enums/payment_status'
import PaymentService from '#core/transactions/application/services/payment_service'
import TransactionService from '#core/transactions/application/services/transaction_service'
import TransactionNotFoundException from '#core/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#core/transactions/infrastructure/exceptions/payment_not_found_exception'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import { AdminAction } from '#shared/enums/provider_error_enums'
import { PROVIDER_SEVERITY_MAP } from '#shared/enums/provider_error_severity_map'
import type { AuditResult } from '#core/audit/domain/enums'
import DispatchFlowEventJob from '#core/transactions/application/jobs/dispatch_flow_event_job'
import type { FlowEventName } from '#core/transactions/application/jobs/dispatch_flow_event_job'
import type {
  SettlementOutcome,
  SettleResult,
} from '#core/money_movement/domain/types/money_movement_types'

/** Codes indiquant que la transition d'état a déjà eu lieu (course / rejeu) → à avaler. */
const TERMINAL_STATE_CODES = new Set([
  'PAYMENT_ALREADY_SUCCESSFUL',
  'PAYMENT_ALREADY_FAILED',
  'TRANSACTION_ALREADY_SUCCESSFUL',
  'TRANSACTION_ALREADY_FAILED',
  'INVALID_STATUS_TRANSITION',
])

/**
 * Plomberie de settlement partagée par le use case `settle` (money-core).
 *
 * Concentre l'infra générique — verrou + chargement, idempotence, transitions d'état
 * « terminal-state-safe » (une transition déjà appliquée est avalée), classification d'erreur
 * provider (CF10) et audit — pour que le use case ne garde que l'orchestration et la logique
 * argent propre à chaque flux. Repris de l'ex-`BaseWebhookHandler`, désormais côté money-core.
 */
@inject()
export default class SettlementSupport {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService
  ) {}

  /** Charge la transaction (verrou `forUpdate`) + tous ses paiements (ordonnés). */
  async loadWithAllPayments(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payments: Payment[] }> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable')
    }

    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid, trx)
    if (payments.length === 0) {
      throw new PaymentNotFoundException('Paiement introuvable pour cette transaction')
    }

    return { transaction, payments }
  }

  /** Charge la transaction (verrou `forUpdate`) + son premier paiement. */
  async loadWithPayment(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payment: Payment }> {
    const { transaction, payments } = await this.loadWithAllPayments(reference, trx)
    return { transaction, payment: payments[0] }
  }

  /** Le mouvement est-il déjà dans l'état terminal attendu (rejeu) ? */
  isIdempotent(transaction: Transaction, payment: Payment, outcome: SettlementOutcome): boolean {
    if (outcome === 'success') {
      return (
        transaction.status === TransactionStatus.SUCCESS && payment.status === PaymentStatus.SUCCESS
      )
    }
    return (
      transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
    )
  }

  markPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    return this.safeTerminal(() =>
      this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    )
  }

  markTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    return this.safeTerminal(() => this.transactionService.markSuccess(transactionId, balance, trx))
  }

  markTransactionFailed(transactionId: number, trx: TransactionClientContract): Promise<void> {
    return this.safeTerminal(() => this.transactionService.markFailed(transactionId, trx))
  }

  /** Marque le paiement échoué + alerte admin selon la classification provider (CF10). */
  markPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract,
    error?: any
  ): Promise<void> {
    return this.safeTerminal(async () => {
      const errorCode = operatorResponse?.code || error?.code
      const definition = errorCode ? ProviderErrorService.resolve(errorCode) : undefined

      await this.paymentService.markFailed(paymentId, { definition, operatorResponse }, trx)

      if (definition && definition.adminAction !== AdminAction.NONE) {
        emitter
          .emit('alert:provider-error', {
            severity: PROVIDER_SEVERITY_MAP[definition.code],
            category: definition.category,
            adminAction: definition.adminAction,
            adminMessage: definition.adminMessage,
            errorCode: definition.code,
            transactionReference: operatorResponse?.reference || String(paymentId),
            provider: operatorResponse?.operator || 'unknown',
            context: { paymentId, operatorResponse, error },
          })
          .catch(() => {})
      }
    })
  }

  /** Émet l'event d'audit produit du settlement (acteur = système). Best-effort. */
  emitAudit(
    transaction: Transaction,
    eventAction: string,
    result: AuditResult,
    metadata: Record<string, unknown>
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction,
        actorId: 'system',
        actorType: 'System',
        targetType: 'Transaction',
        targetId: String(transaction.id),
        result,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        metadata: { reference: transaction.reference, ...metadata },
      })
      .catch(() => {})
  }

  /** Dispatch différé (queue) de l'event par flux — comportement inchangé. */
  async dispatchFlowEvent(
    eventName: FlowEventName,
    transaction: Transaction,
    eventData: Record<string, unknown>
  ): Promise<void> {
    await DispatchFlowEventJob.dispatch({
      eventName,
      eventData: { reference: transaction.reference, ...eventData },
      reference: transaction.reference,
    })
  }

  /** Message d'erreur normalisé pour l'audit. */
  errorMessage(error: unknown): string | null {
    return (error as { message?: string })?.message ?? null
  }

  /** Construit le résultat de règlement. */
  result(transaction: Transaction, alreadySettled: boolean): SettleResult {
    return {
      reference: transaction.reference,
      movementId: String(transaction.id),
      status: transaction.status,
      alreadySettled,
    }
  }

  /** Exécute une transition d'état en avalant les codes « déjà terminal » (course / rejeu). */
  private async safeTerminal(op: () => Promise<unknown>): Promise<void> {
    try {
      await op()
    } catch (error: any) {
      if (!TERMINAL_STATE_CODES.has(error?.code)) throw error
    }
  }
}
