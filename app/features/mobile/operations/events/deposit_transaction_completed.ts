import { BaseEvent } from '@adonisjs/core/events'

export default class DepositCompleted extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor() {
    super()
  }
}