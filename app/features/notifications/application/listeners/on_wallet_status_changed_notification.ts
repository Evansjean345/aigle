import { inject } from '@adonisjs/core'
import NotificationService from '#features/notifications/application/services/notification_service'
import WalletStatusChanged from '#features/wallet/application/events/wallet_status_changed'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { WalletStatus } from '#features/wallet/domain/enums/wallet_status'

@inject()
export default class OnWalletStatusChangedNotification {
  /**
   * Creates an instance of the class with the provided NotificationService.
   *
   * @param {NotificationService} notificationService - The service used to handle notifications.
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles the change in wallet status and sends a notification to the user.
   *
   * @param {WalletStatusChanged} event - The event containing information about the wallet status change, including the user's ID and the new status.
   * @return {Promise<void>} A promise that resolves when the notification has been sent.
   */
  async handle(event: WalletStatusChanged): Promise<void> {
    let title = ''
    let message = ''

    if (event.status === WalletStatus.Inactive) {
      title = 'Portefeuille Désactivé 🔴'
      message =
        "Votre portefeuille a été désactivé par l'administration. Vos transactions sont temporairement bloquées. Veuillez contacter l'assistance si vous avez des questions."
    }

    if (event.status === WalletStatus.Active) {
      title = 'Portefeuille Activé 🟢'
      message =
        'Votre portefeuille a été activé avec succès. Vous pouvez à nouveau effectuer des transactions.'
    }

    if (title && message) {
      const notification = new Notification(event.userId, title, message)
      await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
    }
  }
}
