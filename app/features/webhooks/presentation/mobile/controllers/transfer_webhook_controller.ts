import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class TransferWebhookController {
  /**
   * Creates an instance of the class with a dependency on HandleTransfertWebhookUseCase.
   *
   * @param {HandleTransfertWebhookUseCase} handleTransfertWebhook - An instance of the HandleTransfertWebhookUseCase, responsible for handling transfer webhook logic.
   */
  constructor(private readonly handleTransfertWebhook: HandleTransfertWebhookUseCase) {}

  /**
   * Handles the transfer success webhook.
   *
   * @param {HttpContext} params - The HTTP context object containing the request and response.
   * @param {Object} params.request - The HTTP request object.
   * @param {Object} params.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the webhook has been processed.
   */
  async transferSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'TRANSFER_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received transfer success webhook'
    )

    try {
      const result = await this.handleTransfertWebhook.execute(payload, TransactionStatus.SUCCESS)
      paymentLog.info(
        'TRANSFER_SUCCESS_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Transfer success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'TRANSFER_SUCCESS_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing transfer success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the transfer failure webhook event by processing the provided payload
   * and updating the corresponding transaction status. Logs relevant information
   * about the request and any errors that occur during processing.
   *
   * @param {Object} context - The HTTP context object containing request and response.
   * @param {RequestContract} context.request - The HTTP request object.
   * @param {ResponseContract} context.response - The HTTP response object.
   * @return {Promise<void>} Resolves when the webhook processing is complete.
   */
  async transferFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'TRANSFER_FAILURE_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received transfer failure webhook'
    )

    try {
      const result = await this.handleTransfertWebhook.execute(payload, TransactionStatus.FAILED)
      paymentLog.info(
        'TRANSFER_FAILURE_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Transfer failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'TRANSFER_FAILURE_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing transfer failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
