import NotificationService from '#features/notifications/application/services/notificaton_service'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'
import Device from '#features/device/domain/models/device'

interface NewDeviceDetectedPayload {
  userId: string
  device: Device
}

@inject()
export default class OnNewDeviceDetectedNotification {
  /**
   * Initializes a new instance of the class.
   *
   * @param {NotificationService} notificationService - The service used to handle notifications.
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles the event triggered when a new device is detected.
   * Sends a push notification to the user notifying them about the new device detected on their account.
   *
   * @param {NewDeviceDetectedPayload} event - The payload containing information about the detected device and the associated user.
   * @return {Promise<void>} A promise that resolves when the notification has been successfully sent.
   */
  async handle(event: NewDeviceDetectedPayload): Promise<void> {
    const deviceInfo = event.device.brand
      ? `${event.device.brand} ${event.device.model || ''}`
      : event.device.platform || 'Appareil inconnu'

    const notification = new Notification(
      event.userId,
      'Nouveau device détecté 📱',
      `Un nouvel appareil (${deviceInfo.trim()}) a été détecté sur votre compte. Si ce n'est pas vous, veuillez sécuriser votre compte immédiatement.`
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
