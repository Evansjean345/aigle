import { Job } from '@rlanz/bull-queue'
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
    import(
      '#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'
    ),
} as const

export type WebhookEventName = keyof typeof EVENT_MAP

export interface DispatchWebhookEventPayload {
  eventName: WebhookEventName
  eventData: Record<string, any>
  reference: string
}

export default class DispatchWebhookEventJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  /**
   * Handles the dispatch of a webhook event by loading its corresponding event class
   * and invoking its dispatch method with the provided event data.
   *
   * @param {DispatchWebhookEventPayload} payload - The payload containing details about the webhook event,
   * including the event name, event data, and a reference identifier.
   *
   * @return {Promise<void>} A promise that resolves once the event has been successfully dispatched.
   *
   * @throws {Error} Throws an error if the event name is unknown or not mapped in the event loader.
   */
  async handle(payload: DispatchWebhookEventPayload): Promise<void> {
    const { eventName, eventData, reference } = payload

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

  /**
   * Handles errors occurring during the processing of a webhook event payload by logging the failure.
   *
   * @param {DispatchWebhookEventPayload} payload - The payload of the webhook event containing details about the event.
   * @param {Error} error - The error object that was thrown during the processing of the webhook event.
   * @return {Promise<void>} A promise that resolves when the error is logged.
   */
  async rescue(payload: DispatchWebhookEventPayload, error: Error): Promise<void> {
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
