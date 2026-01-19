import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { Logger, LoggerService } from '@adonisjs/core/logger'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertInterFirstWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_first_webhook.use_case'
import HandleTransfertInterSecondWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_inter_second_webhook.use_case'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

@inject()
export default class TransfertInterWebhookController {
  private readonly logger: LoggerService
  constructor(
    private readonly handleTransfertInterFirstWebhook: HandleTransfertInterFirstWebhookUseCase,
    private readonly handleTransfertInterSecondWebhook: HandleTransfertInterSecondWebhookUseCase,
    private readonly baseLogger: Logger
  ) {
    this.logger = this.baseLogger.use('transaction')
  }

  /**
   * Handle inter-network first operation success webhook
   * @param request
   * @param response
   */
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
      const result = await this.handleTransfertInterFirstWebhook.execute(
        payload,
        TransactionStatus.SUCCESS
      )
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

  /**
   * Handle inter-network first operation failure webhook
   * @param request
   * @param response
   */
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
      const result = await this.handleTransfertInterFirstWebhook.execute(
        payload,
        TransactionStatus.FAILED
      )
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

  /**
   * Handle inter-network second operation success webhook
   * @param request
   * @param response
   */
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
      const result = await this.handleTransfertInterSecondWebhook.execute(
        payload,
        TransactionStatus.SUCCESS
      )
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

  /**
   * Handle inter-network second operation failure webhook
   * @param request
   * @param response
   */
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
      const result = await this.handleTransfertInterSecondWebhook.execute(
        payload,
        TransactionStatus.FAILED
      )
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
