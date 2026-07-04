import { inject } from '@adonisjs/core'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import type { ProviderWebhookEvent } from '#features/webhooks/domain/value_objects/provider_webhook_event'
import type { SettlementKind } from '#features/money_movement/domain/types/money_movement_types'

/**
 * Règlement d'un webhook provider reçu EN DIRECT (Lot 3b — réception directe, sans passer par
 * aiglehub). Traduit un `ProviderWebhookEvent` normalisé en commande `engine.settle` :
 *
 * 1. charge la transaction par `reference` ;
 * 2. déduit le `SettlementKind` de son `operationType` interne + le type d'opération provider
 *    (checkout vs payout) — l'inter-réseau distingue jambe 1 (checkout) et jambe 2 (payout) selon
 *    l'état déjà réglé du 1er paiement ;
 * 3. délègue à l'engine (porte unique de l'argent), qui possède toute la mécanique de settlement.
 *
 * Adaptateur entrant : aucune logique argent ici, comme les handlers de webhook aiglehub.
 */
@inject()
export default class SettleProviderWebhookUseCase {
  constructor(
    private readonly engine: MoneyMovementEngine,
    private readonly paymentService: PaymentService
  ) {}

  async handle(event: ProviderWebhookEvent): Promise<void> {
    const transaction = await Transaction.query().where('reference', event.reference).first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable pour ce webhook provider')
    }

    const kind = await this.resolveKind(transaction, event.operationType)

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
      error: event.errorMessage ? { message: event.errorMessage } : undefined,
    })
  }

  /**
   * Déduit le `SettlementKind` du type interne de la transaction + le type d'opération provider.
   * L'inter-réseau (`inter_reseau`) est une saga 2 jambes : checkout = jambe 1 (cash-in), payout =
   * jambe 2 (cash-out). Un `checkout` reçu alors que le 1er paiement est déjà réglé est traité comme
   * un rejeu de jambe 1 (l'engine le neutralise via son idempotence).
   */
  private async resolveKind(
    transaction: Transaction,
    operationType: 'checkout' | 'payout'
  ): Promise<SettlementKind> {
    switch (transaction.operationType) {
      case TransactionType.DEPOSIT:
        return 'deposit'
      case TransactionType.TRANSFERT:
        return 'transfert'
      case TransactionType.TRANSFERT_INTER:
        return operationType === 'payout' ? 'transfert_inter_second' : 'transfert_inter_first'
      default:
        // Filet de sécurité si un type non couvert atteint la réception : on retombe sur le type
        // d'opération provider (checkout = entrant type deposit, payout = sortant type transfert).
        return this.kindFromOperationType(transaction, operationType)
    }
  }

  private async kindFromOperationType(
    transaction: Transaction,
    operationType: 'checkout' | 'payout'
  ): Promise<SettlementKind> {
    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid)
    const firstSettled = payments[0]?.status === PaymentStatus.SUCCESS

    if (operationType === 'payout') {
      return payments.length >= 2 && firstSettled ? 'transfert_inter_second' : 'transfert'
    }

    return 'deposit'
  }
}
