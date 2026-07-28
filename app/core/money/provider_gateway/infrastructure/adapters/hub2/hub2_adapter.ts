import type { PaymentProviderPort } from '#core/money/provider_gateway/domain/interfaces/payment_provider_port'
import type { ProviderRequest } from '#core/money/provider_gateway/domain/value_objects/provider_request'
import { ProviderResponse } from '#core/money/provider_gateway/domain/value_objects/provider_response'
import type { ProviderOperation } from '#core/money/provider_gateway/domain/types/provider_capabilities'
import type { ProviderPollResult } from '#core/money/provider_gateway/domain/types/provider_poll'
import { ProviderCallError } from '#core/money/provider_gateway/infrastructure/exceptions/provider_call_error'
import { ErrorSeverity } from '#core/money/provider_gateway/domain/enums/error_severity'
import ErrorClassifier from '#core/money/provider_gateway/infrastructure/error_classifier'
import ErrorMessageTranslator from '#core/money/provider_gateway/domain/errors/error_message_translator'
import { resolveOrangeFlow } from '#core/money/provider_gateway/infrastructure/adapters/hub2/orange_payment_flow'
import { HUB2_ERROR_MAP } from '#core/money/provider_gateway/infrastructure/adapters/hub2/hub2_error_map'
import { HUB2_CLIENT_ERRORS } from '#core/money/provider_gateway/domain/errors/hub2_client_errors'
import { apiEnv, apiKey, apiSecret, apiUrl } from '#config/hub2'
import paymentLog from '#shared/infrastructure/logging/payment_log'

const REDIRECT_POLLING_TIMEOUT_MS = 6000
const REDIRECT_POLLING_INTERVAL_MS = 1500

export class Hub2Adapter implements PaymentProviderPort {
  readonly providerName = 'hub2'
  private readonly apiKey: string
  private readonly token: string
  private readonly apiUrl: string
  private readonly env: string

  constructor() {
    this.apiKey = apiKey
    this.token = apiSecret
    this.apiUrl = apiUrl
    this.env = apiEnv
  }

  async checkout(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const intentResponse = await this.createPaymentIntentRequest(request)
      const paymentResponse = await this.processPaymentIntent(
        intentResponse.id,
        intentResponse.token,
        request
      )

      return this.buildCheckoutResponse(paymentResponse)
    } catch (error) {
      return this.handleError(error, 'checkout')
    }
  }

  async payout(request: ProviderRequest): Promise<ProviderResponse> {
    try {
      const response = await this.fetchWithHeaders(`${this.apiUrl}/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          reference: request.transactionId,
          amount: request.amount,
          currency: request.currency,
          description: "transfert d'argent",
          destination: {
            type: 'mobile_money',
            country: request.country,
            recipientName: '',
            msisdn: request.phoneNumber,
            provider: request.metadata.provider ?? request.provider,
          },
        }),
      })

      await this.validateResponse(response)
      const result = (await response.json()) as unknown as Record<string, any>

      return ProviderResponse.success({
        providerReference: result.id ?? result.reference ?? null,
        rawData: result,
      })
    } catch (error) {
      return this.handleError(error, 'payout')
    }
  }

  /**
   * Statut d'un mouvement déjà initié (B6). Seul le **payout** (`/transfers/:id`) est couvert : c'est
   * la voie sortante, celle qui immobilise des fonds quand un webhook se perd. Un checkout orphelin
   * n'a rien réservé côté client → pas d'urgence, et l'endpoint diffère (payment-intents).
   *
   * **Ne devine jamais** : toute réponse non explicitement terminale devient `pending` ou `unknown`,
   * jamais `failed` (un `failed` déclencherait un release/refund à tort).
   */
  async pollStatus(
    operation: ProviderOperation,
    providerReference: string
  ): Promise<ProviderPollResult> {
    if (operation !== 'payout') {
      return { outcome: 'unknown', errorMessage: `Poll non supporté pour l'opération ${operation}` }
    }

    try {
      // Hub2 expose un endpoint **dédié** au statut : `/transfers/:id/status` (et non la ressource).
      const response = await this.fetchWithHeaders(
        `${this.apiUrl}/transfers/${encodeURIComponent(providerReference)}/status`,
        { method: 'GET' }
      )

      // 404 → la référence n'existe pas chez l'opérateur : ambigu (jamais un échec présumé).
      if (response.status === 404) {
        return { outcome: 'unknown', errorCode: 'NOT_FOUND', errorMessage: 'Transfert introuvable' }
      }

      await this.validateResponse(response)
      const result = (await response.json()) as Record<string, any>

      return this.mapTransferStatus(result)
    } catch (error) {
      // Réseau/5xx : on ne conclut rien, le prochain tick réessaiera.
      return {
        outcome: 'unknown',
        errorMessage: error instanceof Error ? error.message : 'Poll échoué',
      }
    }
  }

  /**
   * Mappe le statut Hub2 d'un transfert. Aligné sur les events webhook ('transfer.succeeded` /
   * `transfer.failed') — même vocabulaire, donc même verdict qu'un webhook arrivé normalement.
   */
  private mapTransferStatus(result: Record<string, any>): ProviderPollResult {
    const status = String(result.status ?? '').toLowerCase()

    // Hub2 nomme le statut de la **ressource** `successful', alors que ses **events** webhook disent
    // `transfer.succeeded` — on accepte les deux vocabulaires plutôt que de parier sur l'un.
    if (status === 'successful' || status === 'succeeded' || status === 'success') {
      return { outcome: 'succeeded', rawData: result }
    }

    if (status === 'failed' || status === 'canceled' || status === 'cancelled') {
      return {
        outcome: 'failed',
        errorCode: result.errorCode ?? result.failureCode ?? null,
        errorMessage: result.errorMessage ?? result.failureReason ?? null,
        rawData: result,
      }
    }

    if (status === 'pending' || status === 'processing' || status === 'created') {
      return { outcome: 'pending', rawData: result }
    }

    // Statut inconnu → revue manuelle plutôt qu'un règlement deviné.
    return {
      outcome: 'unknown',
      errorMessage: `Statut Hub2 non reconnu : ${status}`,
      rawData: result,
    }
  }

  private async createPaymentIntentRequest(
    request: ProviderRequest
  ): Promise<{ id: string; token: string }> {
    const response = await this.fetchWithHeaders(`${this.apiUrl}/payment-intents`, {
      method: 'POST',
      body: JSON.stringify({
        customerReference: request.customerReference,
        purchaseReference: request.transactionId,
        amount: request.amount,
        currency: request.currency,
      }),
    })

    return (await response.json()) as { id: string; token: string }
  }

  private async processPaymentIntent(
    paymentIntentId: string,
    token: string,
    request: ProviderRequest
  ): Promise<Record<string, any>> {
    const paymentData = this.buildPaymentData(token, request)

    const response = await fetch(`${this.apiUrl}/payment-intents/${paymentIntentId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData),
    })

    await this.validateResponse(response)
    const responseData = (await response.json()) as Record<string, any>

    if (!responseData.payments || responseData.payments.length === 0) {
      throw new ProviderCallError(
        this.providerName,
        'INVALID_PROVIDER_RESPONSE',
        'No payments returned'
      )
    }

    const payment = responseData.payments[0]
    const waveNeedsPolling = payment.status === 'created' && payment.provider === 'wave'
    const orangeNeedsPolling =
      payment.provider === 'orange' && resolveOrangeFlow(request.metadata).requiresRedirectPolling()

    if (waveNeedsPolling || orangeNeedsPolling) {
      return await this.pollForRedirect(paymentIntentId, token, responseData)
    }

    return responseData
  }

  private buildPaymentData(token: string, request: ProviderRequest): Record<string, any> {
    const mobileMoneyProvider = (request.metadata.provider as string) ?? request.provider

    const data: Record<string, any> = {
      token,
      paymentMethod: 'mobile_money',
      country: request.country,
      provider: mobileMoneyProvider,
      mobileMoney: {
        msisdn: request.phoneNumber,
      },
    }

    if (mobileMoneyProvider === 'orange') {
      resolveOrangeFlow(request.metadata).apply(data.mobileMoney, request.metadata)
    }

    if (mobileMoneyProvider === 'wave') {
      if (request.metadata.success_url)
        data.mobileMoney.onSuccessRedirectionUrl = request.metadata.success_url

      if (request.metadata.error_url)
        data.mobileMoney.onFailedRedirectionUrl = request.metadata.error_url
    }

    return data
  }

  private buildCheckoutResponse(responseData: Record<string, any>): ProviderResponse {
    let redirectUrl: string | null = null

    if (responseData.nextAction?.type === 'redirection' && responseData.nextAction?.data?.url) {
      redirectUrl = responseData.nextAction.data.url
    }

    return ProviderResponse.success({
      providerReference: responseData.id ?? null,
      redirectUrl,
      rawData: responseData as Record<string, unknown>,
    })
  }

  private async pollForRedirect(
    paymentIntentId: string,
    token: string,
    initialResponse: Record<string, any>
  ): Promise<Record<string, any>> {
    const startTime = Date.now()
    let responseData = initialResponse

    while (Date.now() - startTime < REDIRECT_POLLING_TIMEOUT_MS) {
      try {
        const response = await fetch(
          `${this.apiUrl}/payment-intents/${paymentIntentId}?token=${token}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        )
        await this.validateResponse(response)
        responseData = (await response.json()) as Record<string, any>

        if (responseData.nextAction?.type === 'redirection' && responseData.nextAction?.data?.url) {
          break
        }
      } catch (error) {
        paymentLog.error(
          'HUB2_POLLING_FAILED',
          { paymentIntentId, error: String(error) },
          'Polling getPaymentIntent failed'
        )
      }

      await new Promise((resolve) => setTimeout(resolve, REDIRECT_POLLING_INTERVAL_MS))
    }

    return responseData
  }

  private async fetchWithHeaders(url: string, options: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'ApiKey': this.token,
        'MerchantId': this.apiKey,
        'Environment': this.env,
        'Content-Type': 'application/json',
      },
    })

    await this.validateResponse(response)
    return response
  }

  private async validateResponse(response: Response): Promise<void> {
    if (!response.ok) {
      const body = (await response.json()) as Record<string, any>
      paymentLog.error(
        'HUB2_UPSTREAM_ERROR',
        { status: response.status, body },
        'Hub2 upstream error'
      )

      throw new ProviderCallError(
        this.providerName,
        'UPSTREAM_ERROR',
        body.message,
        response.status,
        body
      )
    }
  }

  private handleError(error: unknown, operation: string): ProviderResponse {
    if (error instanceof ProviderCallError) {
      const severity = ErrorClassifier.classify(error, HUB2_ERROR_MAP)
      const clientError = ErrorMessageTranslator.translate(
        { errorCode: error.errorCode, providerName: this.providerName, rawData: error.rawData },
        HUB2_CLIENT_ERRORS
      )

      paymentLog.error(
        'HUB2_OP_FAILED',
        {
          operation,
          errorCode: error.errorCode,
          clientCode: clientError.code,
          errorStatus: error.httpStatus,
          errorSeverity: severity,
        },
        `Hub2 ${operation} failed: ${error.message}`
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
      'HUB2_UNEXPECTED_ERROR',
      { operation, message },
      `Hub2 ${operation} unexpected error`
    )

    return ProviderResponse.failure({
      errorCode: 'INTERNAL_ERROR',
      errorMessage: message,
      severity: ErrorSeverity.AMBIGUOUS,
    })
  }
}
