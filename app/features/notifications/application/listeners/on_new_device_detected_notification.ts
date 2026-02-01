import NotificationService from '#features/notifications/application/services/notificaton_service'
import { Notification } from '#features/notifications/domain/notification'
import { inject } from '@adonisjs/core'
import Device from '#features/device/domain/models/device'
import DeviceService from '#features/device/application/services/device_service'
import { DeviceStatus } from '#features/device/domain/enums'

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
   * @param {DeviceService} deviceService - The service used to manage devices.
   */
  constructor(
    private readonly notificationService: NotificationService,
    private readonly deviceService: DeviceService
  ) {}

  /**
   * Handles the event triggered when a new device is detected.
   * Sends a push notification to the user's other connected devices notifying them about the new device detected on their account.
   *
   * @param {NewDeviceDetectedPayload} event - The payload containing information about the detected device and the associated user.
   * @return {Promise<void>} A promise that resolves when the notification has been successfully sent.
   */
  async handle(event: NewDeviceDetectedPayload): Promise<void> {
    const deviceInfo = event.device.brand
      ? `${event.device.brand} ${event.device.model || ''}`
      : event.device.platform || 'Appareil inconnu'

    // Récupérer les autres appareils de l'utilisateur (en excluant le device détecté)
    const userDevices = await this.deviceService.getDeviceByUserId(event.userId)
    const otherTrustedDevices = userDevices.filter(
      (d) => d.id !== event.device.id && d.status === DeviceStatus.TRUSTED && d.pushToken
    )

    // Si l'utilisateur a d'autres appareils connectés, envoyer la notification à ces appareils
    if (otherTrustedDevices.length > 0) {
      const tokens = otherTrustedDevices.map((d) => d.pushToken).filter(Boolean) as string[]

      if (tokens.length > 0) {
        const notification = new Notification(
          event.userId,
          'Nouveau device détecté 📱',
          `Un nouvel appareil (${deviceInfo.trim()}) a été détecté sur votre compte. Si ce n'est pas vous, veuillez sécuriser votre compte immédiatement.`
        )

        await this.notificationService.sendPushToTokens(tokens, notification)
      }
    }
  }
}
