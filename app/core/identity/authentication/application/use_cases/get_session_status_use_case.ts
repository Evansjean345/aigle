import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import TimedFlag from '#shared/domain/cache/timed_flag'

export interface SessionStatusResult {
  locked: boolean
  reason: 'ACCOUNT_BLOCKED' | 'PIN_TEMPORARILY_BLOCKED' | null
  retryAfterSeconds: number | null
}

@inject()
export default class GetSessionStatusUseCase {
  constructor(private readonly block: TimedFlag) {}

  /**
   * Returns the current lock state for the authenticated user, without mutating it.
   * Used by mobile to validate a biometric unlock against server-side lockout rules.
   */
  async execute(user: User): Promise<SessionStatusResult> {
    if (user.status === UserStatus.BLOCKED) {
      return { locked: true, reason: 'ACCOUNT_BLOCKED', retryAfterSeconds: null }
    }

    const remaining = await this.block.ttl(`auth:pin:block:${user.id}`)

    if (remaining > 0) {
      return {
        locked: true,
        reason: 'PIN_TEMPORARILY_BLOCKED',
        retryAfterSeconds: remaining,
      }
    }

    return { locked: false, reason: null, retryAfterSeconds: null }
  }
}
