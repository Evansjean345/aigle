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
   * Constructor for the TransfertInterWebhookController class.
   * Initializes the dependencies for handling inter-network transfer webhooks.
   *
   * @param handleTransfertInterFirstWebhook
   * @param handleTransfertInterSecondWebhook
   */
  constructor(
    private readonly handleTransfertInterFirstWebhook: HandleTransfertInterFirstWebhookUseCase,
    private readonly handleTransfertInterSecondWebhook: HandleTransfertInterSecondWebhookUseCase
  ) {}

  /**
   * Handles the processing of a webhook notification for an inter-network first operation success event.
   * This method processes the incoming request, logs the details, and invokes the appropriate logic to handle the event.
   *
   * @param {Object} ctx - The HTTP context object containing request and response objects.
   * @param {Object} ctx.request - The HTTP request object containing data sent by the client.
   * @param {Object} ctx.response - The HTTP response object used to send a response back to the client.
   * @return {Promise<void>} A promise that resolves when the processing is complete. The HTTP response is sent as part of this process.
   */
  async interSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
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
   * Handles the inter-network transfer first failure webhook.
   *
   * @param {Object} HttpContext - The HTTP context object containing the request and response.
   * @param {Object} HttpContext.request - The request object containing request data and metadata.
   * @param {Object} HttpContext.response - The response object to send responses.
   * @return {Promise<void>} Resolves when the webhook is processed or an error response is sent.
   */
  async interFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_FAILURE_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
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
   * Handles the inter-network second operation success webhook.
   * Processes the webhook payload and performs necessary actions based on the success event.
   * Logs the event details and operation status for auditing purposes.
   *
   * @param {Object} context - The HTTP context object containing the request and response.
   * @param {Object} context.request - The HTTP request object.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves with no value.
   */
  async interSecondSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
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
   * Handles the inter-network second operation failure webhook by processing the payload
   * and updating the transaction status to FAILED.
   *
   * @param {Object} context - The HTTP context containing the request and response objects.
   * @param {HttpRequest} context.request - The incoming HTTP request object with the payload.
   * @param {HttpResponse} context.response - The outgoing HTTP response object to send the result.
   * @return {Promise<void>} A promise that resolves with no return value after processing the webhook.
   */
  async interSecondFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_FAILURE_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
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
