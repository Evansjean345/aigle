import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import { Logger, LoggerService } from '@adonisjs/core/logger'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

@inject()
export default class TransferWebhookController {
  private readonly logger: LoggerService
  constructor(
    private readonly handleTransfertWebhook: HandleTransfertWebhookUseCase,
    private readonly baseLogger: Logger
  ) {
    this.logger = this.baseLogger.use('transaction')
  }

  async transferSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
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
      this.logger.info({ reference: payload?.data?.reference }, 'Transfer success processed')
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing transfer success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  async transferFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
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
      this.logger.info({ reference: payload?.data?.reference }, 'Transfer failure processed')
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing transfer failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
