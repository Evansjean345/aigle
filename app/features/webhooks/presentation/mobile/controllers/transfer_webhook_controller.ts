import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import HandleTransfertWebhookUseCase from '#features/webhooks/application/use_cases/handle_transfert_webhook.use_case'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import emitter from '@adonisjs/core/services/emitter'

@inject()
export default class TransferWebhookController {
  constructor(private readonly handleTransfertWebhook: HandleTransfertWebhookUseCase) {}

  async transferSuccess({ request, response }: HttpContext): Promise<void> {
    const payload = request.all() as WebhookRequestDto

    console.log('payload', payload)

    paymentLog.info(
      'TRANSFER_SUCCESS_WEBHOOK_RECEIVED',
      {
        path: request.url(true),
        contentType: request.header('content-type'),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received transfer success webhook'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'WEBHOOK_RECEIVED',
        reference: payload?.data?.reference,
        webhookPayload: (payload?.data ?? {}) as Record<string, unknown>,
        ipAddress: request.ip(),
      })
      .catch((_) => {})

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
        { err: { message: (error as any)?.message, stack: (error as any)?.stack, code: (error as any)?.code }, reference: payload?.data?.reference },
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
        contentType: request.header('content-type'),
        reference: payload?.data?.reference,
        ip: request.ip(),
      },
      'Received transfer failure webhook'
    )

    emitter
      .emit('activity:transaction-log', {
        event: 'WEBHOOK_RECEIVED',
        reference: payload?.data?.reference,
        webhookPayload: (payload?.data ?? {}) as Record<string, unknown>,
        ipAddress: request.ip(),
      })
      .catch((_) => {})

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
        { err: { message: (error as any)?.message, stack: (error as any)?.stack, code: (error as any)?.code }, reference: payload?.data?.reference },
        'Error while processing transfer failure webhook'
      )
      return response.ok({ message: 'received' })
    }
  }
}
