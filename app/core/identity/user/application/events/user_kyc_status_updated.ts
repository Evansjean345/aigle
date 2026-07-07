import { BaseEvent } from '@adonisjs/core/events'
import { type UserKycStatus } from '#core/identity/user/domain/enum'
import { type KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'

export default class UserKycStatusUpdated extends BaseEvent {
  constructor(
    public userId: string,
    public status: UserKycStatus,
    public kycLevel?: KycLevelState,
    public comment?: string
  ) {
    super()
  }
}
