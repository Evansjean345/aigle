import type { PaymentProviderPort } from '#core/provider_gateway/domain/interfaces/payment_provider_port'
import type { ProviderRequest } from '#core/provider_gateway/domain/value_objects/provider_request'
import { ProviderResponse } from '#core/provider_gateway/domain/value_objects/provider_response'
import { ProviderCallError } from '#core/provider_gateway/infrastructure/exceptions/provider_call_error'
import ErrorClassifier from '#core/provider_gateway/infrastructure/error_classifier'
import { ErrorSeverity } from '#core/provider_gateway/domain/enums/error_severity'
import ErrorMessageTranslator from '#core/provider_gateway/infrastructure/error_message_translator'
import { WAVE_CLIENT_ERRORS } from '#core/provider_gateway/infrastructure/adapters/wave/wave_client_errors'
import { WAVE_ERROR_MAP } from '#core/provider_gateway/infrastructure/adapters/wave/wave_error_map'
import { aggregatedMerchantId, apiKey, apiUrl } from '#config/wave'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import { randomUUID } from 'node:crypto'

/**
 * Adapter Wave — implémente le PaymentProviderPort.
 *
 * Wave est un provider de mobile money direct (pas via Hub2). Supporte checkout
 * (sessions) et payout. DORMANT au Lot 1 : routé via Hub2 tant que son manifeste
 * n'est pas ajouté aux PROVIDER_MANIFESTS.
 */
export class WaveAdapter implements PaymentProviderPort {
  readonly providerName = 'wave'
  private readonly apiKey: string
  private readonly apiUrl: string
  private readonly aggregatedMerchantId: string

  constructor() {
    this.apiKey = apiKey
    this.apiUrl = apiUrl
    this.aggregatedMerchantId = aggregatedMerchantId
  }

  async checkout(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },

        body: JSON.stringify({
          aggregated_merchant_id: this.aggregatedMerchantId,
          client_reference: request.transactionId,
          amount: request.amount,
          currency: request.currency,
          error_url: request.metadata.error_url ?? null,
          success_url: request.metadata.success_url ?? null,
        }),
      })

      if (!response.ok) {
        const rawData = (await response.json().catch(() => ({}))) as Record<string, any>
        throw new ProviderCallError(
          this.providerName,
          rawData.error ?? 'checkout_failed',
          `Wave checkout API error: ${response.status}`,
          response.status,
          rawData
        )
      }

      const result = (await response.json()) as Record<string, unknown>

      return ProviderResponse.success({
        providerReference: (result.id as string) ?? null,
        redirectUrl: (result.wave_launch_url as string) ?? null,
        rawData: result,
      })
    } catch (error) {
      return this.handleError(error, 'checkout')
    }
  }

  async payout(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'idempotency-key': randomUUID(),
        },
        body: JSON.stringify({
          aggregated_merchant_id: this.aggregatedMerchantId,
          client_reference: request.transactionId,
          receive_amount: request.amount.toString(),
          currency: request.currency,
          mobile: `+225${request.phoneNumber}`,
          national_id: request.country,
        }),
      })

      if (!response.ok) {
        const rawData = (await response.json().catch(() => ({}))) as Record<string, any>
        throw new ProviderCallError(
          this.providerName,
          rawData.error ?? 'payout_failed',
          `Wave payout API error: ${response.status}`,
          response.status,
          rawData
        )
      }

      const result = (await response.json()) as Record<string, unknown>

      return ProviderResponse.success({
        providerReference: (result.id as string) ?? null,
        rawData: result,
      })
    } catch (error) {
      return this.handleError(error, 'payout')
    }
  }

  private handleError(error: unknown, operation: string): ProviderResponse {
    if (error instanceof ProviderCallError) {
      const severity = ErrorClassifier.classify(error, WAVE_ERROR_MAP)
      const clientError = ErrorMessageTranslator.translate(
        { errorCode: error.errorCode, providerName: this.providerName, rawData: error.rawData },
        WAVE_CLIENT_ERRORS
      )

      paymentLog.error(
        'WAVE_OP_FAILED',
        {
          operation,
          errorCode: error.errorCode,
          clientCode: clientError.code,
          errorSeverity: severity,
        },
        `Wave ${operation} failed: ${error.message}`
      )

      return ProviderResponse.failure({
        errorCode: clientError.code,
        errorMessage: clientError.message,
        rawData: error.rawData,
        severity,
      })
    }

    const message = error instanceof Error ? error.message : String(error)
    paymentLog.error(
      'WAVE_UNEXPECTED_ERROR',
      { operation, message },
      `Wave ${operation} unexpected error`
    )

    return ProviderResponse.failure({
      errorCode: 'INTERNAL_ERROR',
      errorMessage: message,
      severity: ErrorSeverity.AMBIGUOUS,
    })
  }
}
