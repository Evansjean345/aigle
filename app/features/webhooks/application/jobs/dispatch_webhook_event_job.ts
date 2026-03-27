import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'

const EVENT_MAP = {
  DepositTransactionCompleted: () =>
    import('#features/webhooks/application/events/deposit/deposit_transaction_completed'),
  DepositTransactionFailed: () =>
    import('#features/webhooks/application/events/deposit/deposit_transaction_failed'),
  TransfertTransactionCompleted: () =>
    import('#features/webhooks/application/events/transfert/transfert_transaction_completed'),
  TransfertTransactionFailed: () =>
    import('#features/webhooks/application/events/transfert/transfert_transaction_failed'),
  TransfertInterTransactionFailed: () =>
    import('#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'),
} as const

export type WebhookEventName = keyof typeof EVENT_MAP

export interface DispatchWebhookEventPayload {
  eventName: WebhookEventName
  eventData: Record<string, any>
  reference: string
}

export default class DispatchWebhookEventJob extends Job<DispatchWebhookEventPayload> {
  async execute(): Promise<void> {
    const { eventName, eventData, reference } = this.payload

    const loader = EVENT_MAP[eventName]
    if (!loader) {
      throw new Error(`Unknown webhook event: ${eventName}`)
    }

    const EventClass = (await loader()).default as any
    await EventClass.dispatch(eventData)

    paymentLog.info(
      `${eventName}_DISPATCHED`,
      { reference, eventName },
      `Webhook event ${eventName} dispatched via job`
    )
  }

  async failed(error: Error): Promise<void> {
    const payload = this.payload
    errorLog.error(
      `${payload.eventName}_JOB_FAILED`,
      {
        reference: payload.reference,
        eventName: payload.eventName,
        error: error.message,
      },
      `Webhook event job failed after all retries: ${payload.eventName}`
    )
  }
}
