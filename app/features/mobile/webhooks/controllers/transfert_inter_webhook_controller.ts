import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { Logger } from '@adonisjs/core/logger'
import { WebhookRequestDto } from '#mobile/webhooks/dto/webhook_request.dto'
import HandleTransfertInterFirstWebhookUseCase from '#mobile/webhooks/use_cases/handle_transfert_inter_first_webhook.use_case'
import HandleTransfertInterSecondWebhookUseCase from '#mobile/webhooks/use_cases/handle_transfert_inter_second_webhook.use_case'

@inject()
export default class TransfertInterWebhookController {
  constructor(
    private readonly handleTransfertInterFirstWebhook: HandleTransfertInterFirstWebhookUseCase,
    private readonly handleTransfertInterSecondWebhook: HandleTransfertInterSecondWebhookUseCase,
    private readonly logger: Logger
  ) {}

  async interSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network first operation success webhook'
    )

    try {
      const result = await this.handleTransfertInterFirstWebhook.execute(payload, 'success')
      this.logger.info(
        { reference: payload?.data?.reference },
        'Inter-network first success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network first operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  async interFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network first operation failure webhook'
    )

    try {
      const result = await this.handleTransfertInterFirstWebhook.execute(payload, 'failed')
      this.logger.info(
        { reference: payload?.data?.reference },
        'Inter-network first failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network first operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  async interSecondSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network second operation success webhook'
    )

    try {
      const result = await this.handleTransfertInterSecondWebhook.execute(payload, 'success')
      this.logger.info(
        { reference: payload?.data?.reference },
        'Inter-network second success processed'
      )
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network second operation success webhook'
      )
      return response.ok({ message: 'received' })
    }
  }

  async interSecondFailure({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    this.logger.info(
      {
        path: request.url(true),
        headers: request.headers(),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received inter-network second operation failure webhook'
    )

    try {
      const result = await this.handleTransfertInterSecondWebhook.execute(payload, 'failed')
      this.logger.info(
        { reference: payload?.data?.reference },
        'Inter-network second failure processed'
      )
      return response.ok(result)
    } catch (error: any) {
      this.logger.error(
        { err: error, reference: payload?.data?.reference },
        'Error while processing inter-network second operation failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
