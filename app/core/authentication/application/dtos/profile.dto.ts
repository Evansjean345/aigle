import type { KycLevelState } from '#core/kyc/domain/enum/kyc_enum'
import { UserKycStatus, type UserStatus } from '#core/user/domain/enum'
import type User from '#core/user/domain/models/user'

export class AuthenticatedProfileResponseDto {
  declare accountNumber: string
  declare id: string
  declare firstname: string
  declare lastname: string
  declare phone: string
  declare accountType: string
  declare pictureUrl: string | null
  declare status: UserStatus
  declare kycLevel: KycLevelState
  declare kycStatus: UserKycStatus
  declare country: Country

  /**
   * Converts a user entity to an AuthenticatedProfileResponseDto
   */
  static fromModel(user: User): AuthenticatedProfileResponseDto {
    const response = new AuthenticatedProfileResponseDto()
    response.id = user.usersUid
    response.firstname = user.firstname
    response.lastname = user.lastname
    response.phone = user.phone
    response.accountNumber = user.accountNumber
    response.accountType = user.accountType
    response.pictureUrl =
      user.kycStatus === UserKycStatus.VERIFIED
        ? user.kycDocument?.selfieUrl || user.pictureUrl || ''
        : ''
    response.status = user.status
    response.kycStatus = user.kycStatus
    response.kycLevel = user.kycLevel
    response.country = {
      id: user.country.id,
      name: user.country.name,
      flag: user.country.flag,
      code: user.country.isoTwo,
    }
    return response
  }
}

interface Country {
  id: number
  name: string
  code: string
  flag: string
}

export class AuthenticatedProfileAndTokenResponseDto {
  declare user: AuthenticatedProfileResponseDto
  declare token: string
  declare type: 'Bearer'

  /**
   * Transforms a user and token into an AuthenticatedProfileAndTokenResponseDto object.
   */
  static from(user: User, token: string): AuthenticatedProfileAndTokenResponseDto {
    const dto = new AuthenticatedProfileAndTokenResponseDto()
    dto.user = AuthenticatedProfileResponseDto.fromModel(user)
    dto.token = token
    dto.type = 'Bearer'
    return dto
  }
}
