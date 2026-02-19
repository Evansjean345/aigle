import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class TransferWebhookController {
  constructor(private readonly handleTransfertWebhook: HandleTransfertWebhookUseCase) {}

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
