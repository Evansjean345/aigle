import { inject } from '@adonisjs/core'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import PaymentRepository from '#core/money/transactions/domain/interfaces/payment_repository'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { ProviderRegistry } from '#core/money/provider_gateway/infrastructure/provider_registry'
import { resolveSettlementKind } from '#core/money/money_movement/domain/services/settlement_kind_resolver'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import type { ProviderOperation } from '#core/money/provider_gateway/domain/types/provider_capabilities'
import type Payment from '#core/money/transactions/domain/models/payment'
import paymentLog from '#shared/infrastructure/logging/payment_log'

import { staleAfterMinutes, reviewAfterMinutes, batchLimit } from '#config/reconciliation'

export interface ReconcileResult {
  scanned: number
  settled: number
  stillPending: number
  needsReview: number
}

@inject()
export default class ReconcilePendingExternalHandler {
  constructor(
    private readonly engine: MoneyMovementEngine,
    private readonly paymentRepository: PaymentRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly registry: ProviderRegistry
  ) {}

  async handle(): Promise<ReconcileResult> {
    const candidates = await this.paymentRepository.findStaleForReconciliation(
      staleAfterMinutes,
      batchLimit
    )

    const result: ReconcileResult = {
      scanned: candidates.length,
      settled: 0,
      stillPending: 0,
      needsReview: 0,
    }

    for (const payment of candidates) {
      try {
        await this.reconcileOne(payment, result)
      } catch (error) {
        paymentLog.error(
          'RECONCILE_ITEM_FAILED',
          {
            paymentId: payment.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'Réconciliation de ce paiement abandonnée'
        )
      }
    }

    return result
  }

  private async reconcileOne(payment: Payment, result: ReconcileResult): Promise<void> {
    const transaction = await this.transactionRepository.findById(payment.transactionsId)
    if (!transaction) return

    const adapter = this.registry.get(payment.aggregator!)

    if (!adapter.pollStatus) {
      this.flagForReview(payment, 'provider sans poll de statut', result)
      return
    }

    const operation = this.resolveProviderOperation(payment)
    const poll = await adapter.pollStatus(operation, payment.providerReference!)

    if (poll.outcome === 'pending') {
      result.stillPending += 1
      return
    }

    if (poll.outcome === 'unknown') {
      this.flagForReview(payment, poll.errorMessage ?? 'statut indéterminé', result)
      return
    }

    const kind = resolveSettlementKind(transaction.operationType, operation)

    paymentLog.info(
      'RECONCILE_SETTLE',
      {
        reference: transaction.reference,
        aggregator: payment.aggregator,
        providerReference: payment.providerReference,
        outcome: poll.outcome,
      },
      'Webhook manquant rattrapé par réconciliation → engine.settle'
    )

    await this.engine.settle({
      reference: transaction.reference,
      kind,
      outcome: poll.outcome === 'succeeded' ? 'success' : 'failure',
      operatorResponse: poll.rawData,
      error:
        poll.outcome === 'failed'
          ? { code: poll.errorCode ?? undefined, message: poll.errorMessage ?? undefined }
          : undefined,
    })

    result.settled += 1
  }

  /**
   * Cas irrésolu : on ne règle rien. Tant que le seuil dur n'est pas franchi, on se contente de
   * repasser au tick suivant (l'opérateur peut encore trancher). Au-delà, on alerte pour revue
   * manuelle — le mouvement est anormalement long, mais deviner reste pire.
   */
  private flagForReview(payment: Payment, reason: string, result: ReconcileResult): void {
    const stalledMinutes = Math.round(Math.abs(payment.updatedAt.diffNow('minutes').minutes))

    if (stalledMinutes < reviewAfterMinutes) {
      result.stillPending += 1
      return
    }

    result.needsReview += 1
    paymentLog.error(
      'RECONCILE_NEEDS_REVIEW',
      {
        paymentId: payment.id,
        transactionId: payment.transactionsId,
        aggregator: payment.aggregator,
        providerReference: payment.providerReference,
        stalledMinutes,
        reason,
      },
      'Mouvement externe irrésolu au-delà du seuil — revue manuelle requise'
    )
  }

  /**
   * Primitive provider du paiement : sortant ('payout') ou entrant ('checkout').
   *
   * Déduite du **step**, qui porte déjà exactement cette distinction à l'initiation :
   * `TRANSFERT_INIT` = cash-out, `DEPOSIT_INIT` = cash-in. L'inter-réseau réutilise ces deux mêmes
   * steps pour ses deux jambes — chacune est donc interrogeable séparément avec la bonne primitive,
   * ce qu'une déduction depuis le type de transaction (identique pour les 2 jambes) ne permettrait
   * pas.
   */
  private resolveProviderOperation(payment: Payment): ProviderOperation {
    return payment.step === PaymentStep.TRANSFERT_INIT ? 'payout' : 'checkout'
  }
}
