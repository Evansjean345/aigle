import { inject } from '@adonisjs/core'
import ExternalMovementStrategy from '#features/money_movement/domain/interfaces/external_movement_strategy'
import type {
  ExternalInitiationBase,
  ExternalOutInitiation,
  ExternalInInitiation,
  ExternalToExternalInitiation,
  ExternalInitiationResult,
} from '#features/money_movement/domain/types/money_movement_types'
import {
  ProviderResolver,
  type RoutableOperation,
} from '#features/provider_gateway/infrastructure/provider_resolver'
import { ProviderRequest } from '#features/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#features/provider_gateway/domain/value_objects/provider_response'
import type { ProviderOperation } from '#features/provider_gateway/domain/types/provider_capabilities'
import { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import ProviderInitiationError from '#features/money_movement/infrastructure/exceptions/provider_initiation_error'
import UnroutablePaymentMethodException from '#features/money_movement/infrastructure/exceptions/unroutable_payment_method_exception'

@inject()
export default class LocalGatewayStrategy implements ExternalMovementStrategy {
  private static readonly DEFAULT_COUNTRY = 'ci'

  constructor(private readonly resolver: ProviderResolver) {}

  /** Entrant (deposit) → checkout. Montant net (comme le chemin http). */
  initiateIn(ctx: ExternalInInitiation): Promise<ExternalInitiationResult> {
    return this.route(ctx, 'checkout', ctx.amount)
  }

  /** Sortant (transfert) → payout. Montant total envoyé à l'opérateur (comme le chemin http). */
  initiateOut(ctx: ExternalOutInitiation): Promise<ExternalInitiationResult> {
    return this.route(ctx, 'payout', ctx.totalAmount)
  }

  /** Opérateur → opérateur (inter, jambe 1 cash-in) → checkout. Montant net. */
  initiateOutToOut(ctx: ExternalToExternalInitiation): Promise<ExternalInitiationResult> {
    return this.route(ctx, 'checkout', ctx.amount)
  }

  private async route(
    ctx: ExternalInitiationBase,
    operation: ProviderOperation,
    amount: number
  ): Promise<ExternalInitiationResult> {
    const adapter = this.resolver.resolve({
      operationType: this.toRoutableOperation(ctx.paymentMethod),
      operator: ctx.operator,
      country: LocalGatewayStrategy.DEFAULT_COUNTRY,
      operation,
    })

    const request = ProviderRequest.create({
      transactionId: ctx.transactionReference,
      amount,
      currency: 'XOF',
      provider: adapter.providerName,
      phoneNumber: ctx.phone.replaceAll(' ', ''),
      country: LocalGatewayStrategy.DEFAULT_COUNTRY,
      metadata: { provider: ctx.operator },
    })

    const response = await this.resolver.invoke(adapter, operation, request)
    return this.mapResponse(response)
  }

  /**
   * Mappe la réponse provider vers le résultat d'initiation de l'engine.
   * Succès → PENDING (+ providerReference, + redirect dans providerData le cas échéant).
   * Échec → `ProviderInitiationError` (la severity porte retryable/definitive/review).
   */
  private mapResponse(response: ProviderResponse): ExternalInitiationResult {
    if (response.isSuccess) {
      return {
        status: TransactionStatus.PENDING,
        providerReference: response.providerReference ?? undefined,
        providerData: response.redirectUrl ? { redirectUrl: response.redirectUrl } : undefined,
      }
    }

    throw new ProviderInitiationError({
      errorCode: response.errorCode ?? 'UNKNOWN',
      message: response.errorMessage ?? 'Provider initiation failed',
      severity: response.severity ?? ErrorSeverity.AMBIGUOUS,
    })
  }

  /**
   * Rétrécit le code moyen de paiement (string, non contraint) vers la `RoutableOperation` typée
   * du provider_gateway. Depuis l'uniformisation du vocabulaire, les valeurs sont identiques (pas
   * de traduction) — cette garde valide l'entrée et **lève** sur un moyen de paiement non routable
   * plutôt que de le rabattre en silence.
   */
  private toRoutableOperation(paymentMethod: string): RoutableOperation {
    switch (paymentMethod) {
      case 'mobile-money':
        return 'mobile-money'
      case 'credit-card':
        return 'credit-card'
      default:
        throw new UnroutablePaymentMethodException(paymentMethod)
    }
  }
}
