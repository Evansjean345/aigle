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
  constructor(
    private readonly handleTransfertInterFirstWebhook: HandleTransfertInterFirstWebhookUseCase,
    private readonly handleTransfertInterSecondWebhook: HandleTransfertInterSecondWebhookUseCase
  ) {}

  /**
   * Handle inter-network first operation success webhook
   * @param request
   * @param response
   */
  async interSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_WEBHOOK_RECEIVED',
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
        'INTER_TRANSFER_FIRST_SUCCESS',
        { webhook: { reference: payload?.data?.reference } },
        'Inter-network first success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_FIRST_ERROR',
        { err: error, webhook: { reference: payload?.data?.reference } },
        'Error while processing inter-network first operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handle inter-network first operation failure webhook
   * @param request
   * @param response
   */
  async interFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_FIRST_WEBHOOK_RECEIVED',
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
        'INTER_TRANSFER_FIRST_FAILURE',
        { webhook: { reference: payload?.data?.reference } },
        'Inter-network first failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_FIRST_ERROR',
        { err: error, webhook: { reference: payload?.data?.reference } },
        'Error while processing inter-network first operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handle inter-network second operation success webhook
   * @param request
   * @param response
   */
  async interSecondSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_WEBHOOK_RECEIVED',
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
        'INTER_TRANSFER_SECOND_SUCCESS',
        { webhook: { reference: payload?.data?.reference } },
        'Inter-network second success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_ERROR',
        { err: error, webhook: { reference: payload?.data?.reference } },
        'Error while processing inter-network second operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  /**
   * Handle inter-network second operation failure webhook
   * @param request
   * @param response
   */
  async interSecondFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    paymentLog.info(
      'INTER_TRANSFER_SECOND_WEBHOOK_RECEIVED',
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
        'INTER_TRANSFER_SECOND_FAILURE',
        { webhook: { reference: payload?.data?.reference } },
        'Inter-network second failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      errorLog.error(
        'INTER_TRANSFER_SECOND_ERROR',
        { err: error, webhook: { reference: payload?.data?.reference } },
        'Error while processing inter-network second operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
