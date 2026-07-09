import { BaseEvent } from '@adonisjs/core/events'
import type Device from '#core/identity/device/domain/models/device'

export default class NewDeviceDetected extends BaseEvent {
  constructor(
    public userId: string,
    public device: Device,
    /** App où l'appareil a été détecté (scoping de la notification). */
    public app: string
  ) {
    super()
  }
}
