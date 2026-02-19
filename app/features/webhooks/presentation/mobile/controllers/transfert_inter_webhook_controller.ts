import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertInterFirstWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_first_webhook.use_case'
import HandleTransfertInterSecondWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_second_webhook.use_case'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class TransfertInterWebhookController {
  /**
   * Constructs an instance of the class with the provided use case handlers.
   *
   * @param {HandleTransfertInterFirstWebhookUseCase} handleTransfertInterFirstWebhook - The use case handler for the first transfer webhook.
   * @param {HandleTransfertInterSecondWebhookUseCase} handleTransfertInterSecondWebhook - The use case handler for the second transfer webhook.
   */
  constructor(
    private readonly handleTransfertInterFirstWebhook: HandleTransfertInterFirstWebhookUseCase,
    private readonly handleTransfertInterSecondWebhook: HandleTransfertInterSecondWebhookUseCase
  ) {}

  /**
   * Handles the "inter-network first operation success" webhook.
   * Processes a webhook notification indicating a successful first operation
   * for an inter-network transfer. Logs information about the receipt and the
   * processing of the webhook.
   *
   * @param {Object} HttpContext - The HTTP context object.
   * @param {Object} HttpContext.request - The HTTP request object containing request data.
   * @param {Object} HttpContext.response - The HTTP response object used to send back the response.
   * @return {Promise<void>} A promise that resolves with no return value but ensures processing of the webhook.
   */
  async interSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network first operation success webhook'
    )

    try {
      const result = await this.handleTransfertInterFirstWebhook.execute(
        payload,
        TransactionStatus.SUCCESS
      )
      paymentLog.info(
        'INTER_TRANSFER_FIRST_SUCCESS_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Inter-network first success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_FIRST_SUCCESS_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network first operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the inter-network transfer first operation failure webhook.
   *
   * @param {Object} context - The HTTP context object.
   * @param {HttpContext} context.request - The HTTP request containing the webhook payload.
   * @param {HttpContext} context.response - The HTTP response used to send back the result.
   * @return {Promise<void>} A promise that resolves once the webhook has been processed.
   */
  async interFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_FAILURE_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network first operation failure webhook'
    )

    try {
      const result = await this.handleTransfertInterFirstWebhook.execute(
        payload,
        TransactionStatus.FAILED
      )
      paymentLog.info(
        'INTER_TRANSFER_FIRST_FAILURE_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Inter-network first failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_FIRST_FAILURE_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network first operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the inter-network transfer second success webhook.
   *
   * This method processes a webhook payload for an inter-network second operation success.
   * It logs the received webhook data, executes business logic, and sends a response.
   *
   * @param {Object} context - The HTTP context containing the request and response objects.
   * @param {Object} context.request - The HTTP request object, holding details such as headers, payload, and URL.
   * @param {Object} context.response - The HTTP response object, used for sending responses back to the client.
   * @return {Promise<void>} A promise that resolves when the webhook is successfully processed or if an error occurs.
   */
  async interSecondSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network second operation success webhook'
    )

    try {
      const result = await this.handleTransfertInterSecondWebhook.execute(
        payload,
        TransactionStatus.SUCCESS
      )
      paymentLog.info(
        'INTER_TRANSFER_SECOND_SUCCESS_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Inter-network second success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_SUCCESS_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network second operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the inter-network second operation failure webhook event. Processes the webhook payload and logs the necessary information.
   * If processing is successful, the result is sent in the HTTP response. In case of an error, the error is logged, and a default response is sent back.
   *
   * @param {Object} context - The HTTP context object containing request and response objects.
   * @param {Object} context.request - The HTTP request object containing the details of the incoming webhook call.
   * @param {Object} context.response - The HTTP response object used to send the processed response back to the client.
   * @return {Promise<void>} Returns a promise that resolves when the webhook handling is completed.
   */
  async interSecondFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_FAILURE_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network second operation failure webhook'
    )

    try {
      const result = await this.handleTransfertInterSecondWebhook.execute(
        payload,
        TransactionStatus.FAILED
      )
      paymentLog.info(
        'INTER_TRANSFER_SECOND_FAILURE_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Inter-network second failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_FAILURE_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network second operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
