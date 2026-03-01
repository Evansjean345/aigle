import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import env from '#start/env'
import config from '@adonisjs/core/services/config'
import HttpClient from '#shared/infrastructure/http_client_service'
import TransactionFailureHandler from '#features/transactions/application/services/transaction_failure_handler'
import type { TransactionFailureOptions } from '#features/transactions/application/services/transaction_failure_handler'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

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
  waveUrl?: string
}

@inject()
export default class SyncCheckoutService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly failureHandler: TransactionFailureHandler
  ) {}

  async checkout(params: SyncCheckoutParams): Promise<SyncCheckoutResult> {
    const dataSend: Record<string, any> = {
      operation_type: params.operationType,
      amount: params.amount,
      provider: params.provider,
      number: params.phone,
      country: 'ci',
      currency: 'XOF',
      reference: params.reference,
      notify_success_url: params.notifySuccessUrl,
      notify_failure_url: params.notifyFailureUrl,
      success_url: config.get('app.mobileDeviceDeepLink'),
      error_url: config.get('app.mobileDeviceDeepLink'),
    }

    const response = await this.httpClient.post(env.get('API_CHECKOUT_URL')!, dataSend)

    if (!response.success) {
      const failureOpts: TransactionFailureOptions = {
        ...params.failureOptions,
        transactionReference: params.reference,
      }

      transactionLog.error(
        `${failureOpts.logCode}_CHECKOUT_FAILED`,
        { reference: params.reference, error: response.error },
        'Sync checkout API call failed'
      )

      await this.failureHandler.handle(failureOpts)

      throw new Exception(response.error.message, {
        code: `${failureOpts.logCode}_CHECKOUT_FAILED`,
        status: 400,
      })
    }

    return {
      waveUrl: response.data?.payment_details?.wave_launch_url,
    }
  }
}
