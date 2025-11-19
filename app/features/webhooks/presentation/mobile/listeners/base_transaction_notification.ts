import DeviceService from '#features/device/application/services/device_service'
import ExpoPushNotificationService from '#shared/services/notification/expo_push_notification_service'
import DepositTransactionCompleted from '#mobile/webhooks/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#mobile/webhooks/events/transfert/transfert_transaction_completed'
import TransfertTransactionFailed from '#mobile/webhooks/events/transfert/transfert_transaction_failed'
import DepositTransactionFailed from '#mobile/webhooks/events/deposit/deposit_transaction_failed'

export type TransactionEvent =
  | DepositTransactionCompleted
  | TransfertTransactionCompleted
  | TransfertTransactionFailed
  | DepositTransactionFailed

export default abstract class BaseTransactionNotification<TEvent extends TransactionEvent> {
  protected constructor(public deviceService: DeviceService) {}

  protected abstract getTitle(event: TEvent): string
  protected abstract getBody(event: TEvent): string

  getNotificationData?(event: TEvent): Record<any, any>

  async handle(event: TEvent) {
    console.log('debugging base transaction notification....')
    console.log(event.data)

    const devices = await this.deviceService.getDeviceByUserId(event.data.userId)
    if (devices.length === 0) return

    const tokens = devices.map((d) => d.token)

    const pushService = new ExpoPushNotificationService()

    if (this.getNotificationData) {
      pushService.setData(this.getNotificationData(event))
    }

    await pushService
      .setPushToken(tokens)
      .setTitle(this.getTitle(event))
      .setBody(this.getBody(event))
      .send()
  }
}
