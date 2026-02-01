import { BaseEvent } from '@adonisjs/core/events'
import { UserKycStatus } from '#features/user/domain/enum'
import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'

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
