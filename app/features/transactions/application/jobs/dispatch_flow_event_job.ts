import { Job } from '@adonisjs/queue'
import errorLog from '#shared/infrastructure/logging/error_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'

const EVENT_MAP = {
  DepositTransactionCompleted: () =>
    import('#features/transactions/application/events/deposit_transaction_completed'),
  DepositTransactionFailed: () =>
    import('#features/transactions/application/events/deposit_transaction_failed'),
  TransfertTransactionCompleted: () =>
    import('#features/transactions/application/events/transfert_transaction_completed'),
  TransfertTransactionFailed: () =>
    import('#features/transactions/application/events/transfert_transaction_failed'),
  TransfertInterTransactionFailed: () =>
    import('#features/transactions/application/events/transfert_inter_transaction_failed'),
} as const

export type FlowEventName = keyof typeof EVENT_MAP

export interface DispatchFlowEventPayload {
  eventName: FlowEventName
  eventData: Record<string, any>
  reference: string
}

export default class DispatchFlowEventJob extends Job<DispatchFlowEventPayload> {
  async execute(): Promise<void> {
    const { eventName, eventData, reference } = this.payload

    const loader = EVENT_MAP[eventName]

    if (!loader) {
      throw new Error(`Unknown webhook event: ${eventName}`)
    }

    const module = await loader()
    const EventClass = module.default as any
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
      `Webhook event job failed: ${payload.eventName}`
    )
  }
}
