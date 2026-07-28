import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import type Transaction from '#core/money/transactions/domain/models/transaction'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { redactSensitive } from '#shared/infrastructure/logging/redact_sensitive'
import { resolveSettlementKind } from '#core/money/money_movement/domain/services/settlement_kind_resolver'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import type { ProviderWebhookEvent } from '#core/money/webhooks/domain/value_objects/provider_webhook_event'
import type { SettlementKind } from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Règlement d'un webhook provider reçu EN DIRECT (Lot 3b — réception directe, sans passer par
 * aiglehub). Traduit un `ProviderWebhookEvent` normalisé en commande `engine.settle` :
 *
 * 1. charge la transaction par `reference` ;
 * 2. déduit le `SettlementKind` de son `operationType` interne + le type d'opération provider
 *    (checkout vs payout) — l'inter-réseau distingue jambe 1 (checkout) et jambe 2 (payout) ;
 * 3. délègue à l'engine (porte unique de l'argent), qui possède toute la mécanique de settlement.
 *
 * Adaptateur entrant : aucune logique argent ici, comme les handlers de webhook aiglehub.
 */
@inject()
export default class SettleProviderWebhookUseCase {
  constructor(
    private readonly engine: MoneyMovementEngine,
    private readonly transactionRepository: TransactionRepository
  ) {}

  async handle(event: ProviderWebhookEvent): Promise<void> {
    emitter
      .emit('activity:transaction-log', {
        event: 'WEBHOOK_RECEIVED',
        reference: event.reference,
        webhookPayload: redactSensitive(event.rawData) as Record<string, unknown>,
      })
      .catch(() => {})

    const transaction = await this.transactionRepository.findByReference(event.reference)

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable pour ce webhook provider')
    }

    const kind = this.resolveKind(transaction, event.operationType)

    paymentLog.info(
      'PROVIDER_WEBHOOK_SETTLE',
      { reference: event.reference, provider: event.providerName, kind, outcome: event.outcome },
      'Direct provider webhook → engine.settle'
    )

    await this.engine.settle({
      reference: event.reference,
      kind,
      outcome: event.outcome === 'success' ? 'success' : 'failure',
      operatorResponse: event.rawData,
      // Code canonique + message → classification/persistance/alerte côté settlement (markPaymentFailed).
      error:
        event.errorCode || event.errorMessage
          ? { code: event.errorCode ?? undefined, message: event.errorMessage ?? undefined }
          : undefined,
    })
  }

  /**
   * Déduit le `SettlementKind` du type interne de la transaction (+ le type d'opération provider
   * pour l'inter-réseau : checkout = jambe 1 cash-in, payout = jambe 2 cash-out).
   *
   * Un type non couvert est une **anomalie** (transaction non réglable par webhook) : on **échoue
   * bruyamment** plutôt que de deviner un règlement — c'est de l'argent, pas de fallback silencieux.
   */
  private resolveKind(
    transaction: Transaction,
    operationType: 'checkout' | 'payout'
  ): SettlementKind {
    return resolveSettlementKind(transaction.operationType, operationType)
  }
}
