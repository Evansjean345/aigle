import { inject } from '@adonisjs/core'
import HandleDepositWebhookUseCase from '#features/webhooks/application/use_cases/handle_deposit_webhook.use_case'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

/**
 * Controller for handling deposit webhook events.
 * This controller processes webhook notifications related to deposits,
 * including both successful and failed transactions, by delegating the business logic
 * to the provided use case and returning the appropriate HTTP responses.
 */
@inject()
export default class DepositWebhookController {
  /**
   * Creates an instance of the class with the provided HandleDepositWebhookUseCase.
   *
   * @param {HandleDepositWebhookUseCase} handleDepositWebhook - The use case that manages deposit webhook handling logic.
   */
  constructor(private readonly handleDepositWebhook: HandleDepositWebhookUseCase) {}

  /**
   * Handles a successful deposit webhook event by processing the payload and returning an appropriate response.
   *
   * @param {Object} args - The context object containing the request and response.
   * @param {Object} args.request - The HTTP request object, which contains the incoming data.
   * @param {Object} args.response - The HTTP response object, used to return the result or status.
   * @return {Promise<void>} Resolves with the result of the deposit processing or an acknowledgment message.
   */
  async depositSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    transactionLog.info(
      '>>> DEPOSIT_SUCCESS_WEBHOOK_RECEIVED',
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
      transactionLog.info(
        '>>> DEPOSIT_SUCCESS_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Deposit success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      transactionLog.error(
        '>>> DEPOSIT_SUCCESS_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing deposit success webhook'
      )
      // Always acknowledge
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handles a failed deposit webhook and processes the incoming payload.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request containing the incoming payload.
   * @param {Object} context.response - The HTTP response used to send back the status and result.
   * @return {Promise<void>} Resolves with the HTTP response object, indicating the result of the processing.
   */
  async depositFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    transactionLog.info(
      '>>> DEPOSIT_FAILED_WEBHOOK_RECEIVED',
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
      transactionLog.info(
        'DEPOSIT_FAILED_WEBHOOK_PROCESSED',
        { reference: payload?.data?.reference },
        'Deposit failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      transactionLog.error(
        'DEPOSIT_FAILED_WEBHOOK_ERROR',
        { err: error, reference: payload?.data?.reference },
        'Error while processing deposit failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
