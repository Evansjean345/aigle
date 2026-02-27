import { BaseEvent } from '@adonisjs/core/events'
import Device from '#features/device/domain/models/device'

export default class NewDeviceDetected extends BaseEvent {
  constructor(
    public userId: string,
    public device: Device
  ) {
    super()
  }
}
