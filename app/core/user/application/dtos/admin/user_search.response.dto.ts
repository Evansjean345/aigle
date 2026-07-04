import { type UserKycStatus, type UserStatus } from '#core/user/domain/enum'
import type User from '#core/user/domain/models/user'

export class UserSearchResponseDto {
  declare usersUid: string
  declare fullname: string
  declare phone: string
  declare profilePic: string | null
  declare country: {
    name: string
    flag: string
    phoneCode: string
  }
  declare kyc: {
    level: number
    status: UserKycStatus
  }
  declare status: UserStatus

  static fromUser(user: User): UserSearchResponseDto {
    const dto = new UserSearchResponseDto()
    dto.usersUid = user.usersUid
    dto.fullname = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
    dto.phone = user.phone
    dto.profilePic = user.kycDocument?.selfieUrl || null
    dto.country = {
      name: user.country?.name || '',
      flag: user.country?.flag || '',
      phoneCode: user.country?.phoneCode || '',
    }
    dto.kyc = {
      level: user.keyLevel?.level || 0,
      status: user.kycStatus,
    }
    dto.status = user.status
    return dto
  }
}
