import { BaseEvent } from '@adonisjs/core/events'

export default class AccountVerified extends BaseEvent {
  constructor(
    public userId: string,
    public phone: string,
    public providerId?: number
  ) {
    super()
  }
}
