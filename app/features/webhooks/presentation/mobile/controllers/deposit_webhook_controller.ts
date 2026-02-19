import { inject } from '@adonisjs/core'
import HandleDepositWebhookUseCase from '#features/webhooks/application/use_cases/handle_deposit_webhook.use_case'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class DepositWebhookController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {HandleDepositWebhookUseCase} handleDepositWebhook - The use case responsible for handling deposit webhooks.
   */
  constructor(private readonly handleDepositWebhook: HandleDepositWebhookUseCase) {}

  /**
   * Handles the deposit success webhook by processing the incoming payload and updating the transaction status to success.
   * Logs relevant information and processes any errors that occur during the execution.
   *
   * @param {Object} HttpContext - The context object containing the HTTP request and response.
   * @param {Object} HttpContext.request - The HTTP request object, providing details such as headers, URL, IP, and payload.
   * @param {Object} HttpContext.response - The HTTP response object, used to send a response back to the client.
   * @return {Promise<void>} A promise that resolves with no value once the webhook processing is complete.
   */
  async depositSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'DEPOSIT_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received deposit success webhook'
    )

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
        { err: error, reference: payload?.data?.reference },
        'Error while processing deposit success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles the deposit failure webhook received from an external service.
   * This method processes the webhook payload, logs relevant information,
   * and updates the system with the failed transaction state.
   *
   * @param {Object} HttpContext - The HTTP context object containing the request and response.
   * @param {Object} HttpContext.request - The incoming HTTP request object.
   * @param {Object} HttpContext.response - The outgoing HTTP response object.
   * @return {Promise<void>} Resolves with no value once processing is complete, sending a response status back to the caller.
   */
  async depositFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'DEPOSIT_FAILED_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received deposit failure webhook'
    )

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
        { err: error, reference: payload?.data?.reference },
        'Error while processing deposit failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
