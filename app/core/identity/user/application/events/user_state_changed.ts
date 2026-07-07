import { BaseEvent } from '@adonisjs/core/events'
import { type UserStatus } from '#core/identity/user/domain/enum'

/**
 * Represents an event that is triggered when a user's state changes.
 * Extends the BaseEvent class to handle user-related state change events.
 */
export default class UserStateChanged extends BaseEvent {
  /**
   * Constructor for initializing a new instance of the class.
   *
   * @param {string} userId - The unique identifier for the user.
   * @param {UserStatus} status - The status of the user.
   */
  constructor(
    public userId: string,
    public status: UserStatus
  ) {
    super()
  }
}
