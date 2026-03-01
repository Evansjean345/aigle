import { inject } from '@adonisjs/core'
import HandleDepositWebhookUseCase from '#features/webhooks/application/use_cases/handle_deposit_webhook.use_case'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class DepositWebhookController {
  constructor(private readonly handleDepositWebhook: HandleDepositWebhookUseCase) {}

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