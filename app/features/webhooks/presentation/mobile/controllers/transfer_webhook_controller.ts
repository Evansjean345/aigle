import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import { Logger } from '@adonisjs/core/logger'

@inject()
export default class TransferWebhookController {
  constructor(
    private readonly handleTransfertWebhook: HandleTransfertWebhookUseCase,
    private readonly logger: Logger
  ) {}

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
      const result = await this.handleTransfertWebhook.execute(payload, 'success')
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
      const result = await this.handleTransfertWebhook.execute(payload, 'failed')
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
