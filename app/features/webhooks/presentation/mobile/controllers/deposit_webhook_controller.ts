import { inject } from '@adonisjs/core'
import HandleDepositWebhookUseCase from '#features/webhooks/application/use_cases/handle_deposit_webhook.use_case'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import emitter from '@adonisjs/core/services/emitter'

@inject()
export default class DepositWebhookController {
  /**
   * Creates an instance of the class.
   *
   * @param {HandleDepositWebhookUseCase} handleDepositWebhook - The use case responsible for handling the deposit webhook logic.
   */
  constructor(private readonly handleDepositWebhook: HandleDepositWebhookUseCase) {}

  /**
   * Handles the deposit success webhook and processes the corresponding logic.
   *
   * @param {Object} context - The HTTP context object containing the request and response.
   * @param {Object} context.request - The HTTP request object, which includes information such as headers, body, and URL.
   * @param {Object} context.response - The HTTP response object used to send a response back to the client.
   * @return {Promise<void>} A promise that resolves when the deposit webhook is successfully processed or handled in case of an error.
   */
  async depositSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'DEPOSIT_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received deposit success webhook'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'WEBHOOK_RECEIVED',
        reference: payload?.data?.reference,
        webhookPayload: (payload?.data ?? {}) as Record<string, any>,
        ipAddress: request.ip(),
      })
      .catch((_) => {})

    try {
      const result = await this.handleDepositWebhook.execute(payload, TransactionStatus.SUCCESS)
      paymentLog.info(
        'DEPOSIT_SUCCESS_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Deposit success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'DEPOSIT_SUCCESS_WEBHOOK_ERROR',
        {
          err: {
            message: (error as any)?.message,
            stack: (error as any)?.stack,
            code: (error as any)?.code,
          },
          reference: payload?.data?.reference,
        },
        'Error while processing deposit success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the deposit failure webhook by processing the incoming payload and updating the transaction status to "FAILED".
   *
   * @param {Object} param0 - The HTTP context object.
   * @param {Object} param0.request - The HTTP request object containing the payload and associated metadata.
   * @param {Object} param0.response - The HTTP response object used to send responses back to the client.
   * @return {Promise<void>} A promise that resolves with no value, indicating the method handles the response internally.
   */
  async depositFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'DEPOSIT_FAILED_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received deposit failure webhook'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'WEBHOOK_RECEIVED',
        reference: payload?.data?.reference,
        webhookPayload: (payload?.data ?? {}) as Record<string, any>,
        ipAddress: request.ip(),
      })
      .catch((_) => {})

    try {
      const result = await this.handleDepositWebhook.execute(payload, TransactionStatus.FAILED)
      paymentLog.info(
        'DEPOSIT_FAILED_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Deposit failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'DEPOSIT_FAILED_WEBHOOK_ERROR',
        {
          err: {
            message: (error as any)?.message,
            stack: (error as any)?.stack,
            code: (error as any)?.code,
          },
          reference: payload?.data?.reference,
        },
        'Error while processing deposit failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
