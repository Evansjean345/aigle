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

/**
 * Stratégie d'initiation externe — routage IN-PROCESS via le provider_gateway (Lot 1).
 *
 * Implémente le port `ExternalMovementStrategy` en routant chaque primitive vers un adapter
 * provider (Hub2…) au lieu du chemin HTTP vers aiglehub :
 *   - initiateIn (deposit)      → opération `checkout` (pay-in)
 *   - initiateOut (transfert)   → opération `payout`
 *   - initiateOutToOut (inter)  → opération `checkout` (cash-in jambe 1)
 *
 * ⚠ ÉCRITE MAIS **NON BINDÉE** au Lot 2 : c'est `http_aggregator_strategy` qui est active. La
 * bascule (lot 3b) = binder ce port sur cette classe. La couture est testée unitairement (mapping
 * `ProviderResponse`/severity → résultat engine) pour que la bascule soit un flip de config.
 *
 * Dette connue (à lever au 3b, comme le chemin http) : `country` codé en dur 'ci' (le contexte
 * d'initiation ne le véhicule pas encore) ; metadata provider minimale (redirect/otp orange/wave
 * à compléter à l'activation).
 */
@inject()
export default class LocalGatewayStrategy extends ExternalMovementStrategy {
  private static readonly DEFAULT_COUNTRY = 'ci'

  constructor(private readonly resolver: ProviderResolver) {
    super()
  }

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
      operationType: this.railFor(ctx.paymentMethod),
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
      // L'adapter lit l'opérateur mobile money dans `metadata.provider` (le champ `provider`
      // du request = nom du gateway). Cf. Hub2Adapter.buildPaymentData.
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

  private railFor(paymentMethod: string): RoutableOperation {
    return paymentMethod === 'credit-card' ? 'credit-card' : 'mobile_money'
  }
}
