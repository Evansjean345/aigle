import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import ExternalMovementGateway from '#core/money_movement/domain/interfaces/external_movement_gateway'
import { redactSensitive } from '#shared/infrastructure/logging/redact_sensitive'
import type {
  ExternalInitiationBase,
  ExternalOutInitiation,
  ExternalInInitiation,
  ExternalToExternalInitiation,
  ExternalSecondLegInitiation,
  ExternalInitiationResult,
} from '#core/money_movement/domain/types/money_movement_types'
import {
  ProviderResolver,
  type RoutableOperation,
} from '#core/provider_gateway/infrastructure/provider_resolver'
import { ProviderRequest } from '#core/provider_gateway/domain/value_objects/provider_request'
import type { ProviderResponse } from '#core/provider_gateway/domain/value_objects/provider_response'
import type { ProviderOperation } from '#core/provider_gateway/domain/types/provider_capabilities'
import { ErrorSeverity } from '#core/provider_gateway/domain/enums/error_severity'
import { TransactionStatus } from '#core/transactions/domain/enums/transaction_status'
import ProviderInitiationError from '#core/money_movement/infrastructure/exceptions/provider_initiation_error'
import UnroutablePaymentMethodException from '#core/money_movement/infrastructure/exceptions/unroutable_payment_method_exception'

/**
 * Implémentation du port `ExternalMovementGateway` : adapte l'initiation externe du moteur vers la
 * feature provider_gateway (in-process). Résout le provider via `ProviderResolver` selon le moyen
 * de paiement + l'opérateur, mappe la primitive (checkout/payout) et le montant, invoque l'adapter
 * et traduit la réponse (PENDING + providerReference/redirect) ou l'échec (`ProviderInitiationError`
 * porté par la severity). Seul chemin depuis la bascule Lot 3b (aiglehub absorbé).
 */
@inject()
export default class ProviderGatewayAdapter implements ExternalMovementGateway {
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

  /** Inter jambe 2 (cash-out bénéficiaire) → payout. Montant total envoyé à l'opérateur. */
  initiateSecondLeg(ctx: ExternalSecondLegInitiation): Promise<ExternalInitiationResult> {
    return this.route(ctx, 'payout', ctx.totalAmount)
  }

  private async route(
    ctx: ExternalInitiationBase,
    operation: ProviderOperation,
    amount: number
  ): Promise<ExternalInitiationResult> {
    const adapter = this.resolver.resolve({
      operationType: this.toRoutableOperation(ctx.paymentMethod),
      operator: ctx.operator,
      country: ProviderGatewayAdapter.DEFAULT_COUNTRY,
      operation,
    })

    const request = ProviderRequest.create({
      transactionId: ctx.transactionReference,
      // Référence client stable exigée par les providers (Hub2 rejette un customerReference
      // non-string) — l'identifiant utilisateur interne joue ce rôle.
      customerReference: ctx.userId,
      amount,
      currency: 'XOF',
      provider: adapter.providerName,
      phoneNumber: ctx.phone.replaceAll(' ', ''),
      country: ProviderGatewayAdapter.DEFAULT_COUNTRY,
      metadata: { provider: ctx.operator },
    })

    // Trace forensique de l'I/O provider dans transaction_logs (brut redacté). Best-effort.
    this.logSent(ctx, adapter.providerName, operation, {
      customerReference: ctx.userId,
      purchaseReference: ctx.transactionReference,
      amount,
      currency: 'XOF',
      phoneNumber: request.phoneNumber,
    })

    let response: ProviderResponse
    try {
      response = await this.resolver.invoke(adapter, operation, request)
    } catch (error) {
      this.logResponse(ctx, adapter.providerName, operation, false, {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }

    this.logResponse(ctx, adapter.providerName, operation, response.isSuccess, response.rawData)
    return this.mapResponse(response)
  }

  /** Journalise l'appel sortant vers le provider (transaction_logs). Best-effort, non bloquant. */
  private logSent(
    ctx: ExternalInitiationBase,
    provider: string,
    operation: ProviderOperation,
    rawRequest: Record<string, unknown>
  ): void {
    emitter
      .emit('activity:transaction-log', {
        event: 'SENT_TO_AGGREGATOR',
        transactionId: ctx.transactionReference,
        provider,
        reference: ctx.transactionReference,
        operation,
        rawRequest: redactSensitive(rawRequest) as Record<string, unknown>,
      })
      .catch(() => {})
  }

  /** Journalise la réponse brute du provider (succès ou corps d'erreur). Best-effort. */
  private logResponse(
    ctx: ExternalInitiationBase,
    provider: string,
    operation: ProviderOperation,
    success: boolean,
    rawResponse: Record<string, unknown>
  ): void {
    emitter
      .emit('activity:transaction-log', {
        event: 'AGGREGATOR_RESPONSE_RECEIVED',
        transactionId: ctx.transactionReference,
        provider,
        success,
        operation,
        rawResponse: redactSensitive(rawResponse) as Record<string, unknown>,
      })
      .catch(() => {})
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
