import { BaseEvent } from '@adonisjs/core/events'
import { type UserKycStatus } from '#features/user/domain/enum'
import { type KycLevelState } from '#features/kyc/domain/enum/kyc_enum'

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
