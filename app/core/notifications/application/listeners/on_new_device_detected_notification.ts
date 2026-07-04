import NotificationService from '#core/notifications/application/services/notification_service'
import { Notification } from '#core/notifications/domain/notification'
import { inject } from '@adonisjs/core'
import Device from '#core/device/domain/models/device'
import DeviceService from '#core/device/application/services/device_service'
import { DeviceStatus } from '#core/device/domain/enums'

interface NewDeviceDetectedPayload {
  userId: string
  device: Device
}

@inject()
export default class OnNewDeviceDetectedNotification {
  /**
   * Creates an instance of OnNewDeviceDetectedNotification.
   * @param {NotificationService} notificationService - Used for sending notifications.
   * @param {DeviceService} deviceService - Used for managing device-related operations.
   */
  constructor(
    private readonly notificationService: NotificationService,
    private readonly deviceService: DeviceService
  ) {}

  /**
   * Handles the event when a new device is detected.
   * @param {NewDeviceDetectedPayload} event - The event payload containing device information.
   */
  async handle(event: NewDeviceDetectedPayload): Promise<void> {
    const deviceInfo = event.device.brand
      ? `${event.device.brand} ${event.device.model || ''}`
      : event.device.platform || 'Appareil inconnu'

    // Récupérer les autres appareils actifs de l'utilisateur
    const userDevices = await this.deviceService.getActiveUserDevices(event.userId)

    const otherTrustedDevices = userDevices.filter(
      (ud) => ud.deviceId !== event.device.id && ud.status === DeviceStatus.TRUSTED && ud.pushToken
    )

    if (otherTrustedDevices.length > 0) {
      const tokens = otherTrustedDevices.map((ud) => ud.pushToken).filter(Boolean) as string[]

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
