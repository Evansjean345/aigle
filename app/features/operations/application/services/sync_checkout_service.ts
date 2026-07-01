import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import env from '#start/env'
import config from '@adonisjs/core/services/config'
import HttpClient from '#shared/infrastructure/services/http_client_service'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import type { TransactionFailureOptions } from '#features/transactions/application/services/transaction_failure_handler'
import emitter from '@adonisjs/core/services/emitter'
import ErrorClassifier from '#shared/infrastructure/services/error_classifier'
import ProviderErrorReporter from '#shared/infrastructure/services/provider_error_reporter'

export interface SyncCheckoutParams {
  operationType: string
  amount: number
  provider: string
  phone: string
  reference: string
  notifySuccessUrl: string
  notifyFailureUrl: string
  failureOptions: Omit<TransactionFailureOptions, 'transactionReference'> & {
    transactionReference?: string
  }
}

export interface SyncCheckoutResult {
  redirectUrl?: string
  type?: string
}

@inject()
export default class SyncCheckoutService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly failureHandler: TransactionFailureHandler
  ) {}

  /**
   * Executes a checkout operation by sending payment details to a third-party API.
   *
   * @param {SyncCheckoutParams} params - The parameters required to perform the checkout operation. It includes:
   * - `operationType`: The type of operation being performed.
   * - `amount`: The transaction amount.
   * - `provider`: The payment provider.
   * - `phone`: The customer's phone number.
   * - `reference`: A unique transaction reference.
   * - `notifySuccessUrl`: The URL to notify on successful payment.
   * - `notifyFailureUrl`: The URL to notify on payment failure.
   * - `failureOptions`: Additional options for handling failure scenarios.
   *
   * @return {Promise<SyncCheckoutResult>} A promise that resolves to an object containing the payment details, such as a `waveUrl` for launching the payment with Wave.
   *
   * @throws {Exception} Throws an exception if the checkout operation fails, with details about the error and a status code.
   */
  async checkout(params: SyncCheckoutParams): Promise<SyncCheckoutResult> {
    const deepLink = (() => {
      const url = new URL(config.get('app.mobileDeviceDeepLink') as string)
      url.searchParams.set('reference', params.reference)
      url.searchParams.set('provider', params.provider)
      return url.toString()
    })()

    const dataSend: Record<string, any> = {
      channel: params.operationType,
      amount: params.amount,
      provider: params.provider,
      number: params.phone,
      country: 'ci',
      currency: 'XOF',
      reference: params.reference,
      notify_success_url: params.notifySuccessUrl,
      notify_failure_url: params.notifyFailureUrl,
      success_url: deepLink,
      error_url: deepLink,
    }

    if (params.provider === 'orange') {
      dataSend.payment_mode = 'payment_link'
    }

    const response = await this.httpClient.post(env.get('API_CHECKOUT_URL')!, dataSend)

    emitter
      .emit('activity:transaction-log', {
        event: 'SENT_TO_AGGREGATOR',
        transactionId: params.reference,
        provider: params.provider,
        reference: params.reference,
      })
      .catch((_) => {})

    emitter
      .emit('activity:transaction-log', {
        event: 'AGGREGATOR_RESPONSE_RECEIVED',
        transactionId: params.reference,
        provider: params.provider,
        success: response.success,
        errorMessage: response.success ? undefined : response.error?.message,
      })
      .catch((_) => {})

    if (!response.success) {
      const classified = ErrorClassifier.classify({
        httpStatus: response.error?.statusCode,
        message: response.error?.message,
        networkCode: response.error?.code,
      })

      const failureOpts: TransactionFailureOptions = {
        ...params.failureOptions,
        transactionReference: params.reference,
      }

      // Pipeline log + alerte uniformisé avec celui des jobs (cf.
      // BaseAggregatorJob). Avant ce refactor, la branche sync ne
      // logguait qu'en `error` indistinctement et n'émettait aucune
      // alerte monitoring.
      ProviderErrorReporter.report(classified, response.error ?? {}, {
        logPrefix: failureOpts.logCode,
        transactionReference: params.reference,
        provider: params.provider,
        paymentMethod: params.operationType,
        operationType: failureOpts.logCode,
      })

      await this.failureHandler.handle(failureOpts)

      throw new Exception(response.error.message, {
        code: `${failureOpts.logCode}_CHECKOUT_FAILED`,
        status: classified.retryable ? 502 : 500,
      })
    }

    return {
      type: response.data?.payment_details?.type,
      // `wave_launch_url` est le champ historique de la passerelle ; `redirect_url`
      // est le nouveau nom générique. On lit le second en priorité avec repli sur
      // le premier pour rester robuste quel que soit l'ordre de déploiement.
      redirectUrl:
        response.data?.payment_details?.redirect_url ??
        response.data?.payment_details?.wave_launch_url,
    }
  }
}
