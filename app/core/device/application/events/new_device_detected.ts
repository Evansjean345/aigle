import { BaseEvent } from '@adonisjs/core/events'
import type Device from '#core/device/domain/models/device'

export default class NewDeviceDetected extends BaseEvent {
  constructor(
    public userId: string,
    public device: Device
  ) {
    super()
  }
}
