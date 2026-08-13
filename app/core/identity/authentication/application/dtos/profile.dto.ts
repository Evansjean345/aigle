import type { KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import { type UserStatus } from '#core/identity/user/domain/enum'
import {
  AccountVerificationStatus,
  statusOfFile,
} from '#core/identity/kyc/domain/verification_status'
import type User from '#core/identity/user/domain/models/user'

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
  declare kycStatus: AccountVerificationStatus
  declare country: Country

  /**
   * Converts a user entity to an AuthenticatedProfileResponseDto
   *
   * @param {User} user - Utilisateur authentifié.
   * @param {string | null} [selfieUrl] - Adresse consultable du selfie de vérification, résolue par
   *   l'appelant : un selfie récent vit sur le stockage privé et demande une signature, que ce DTO
   *   ne peut pas produire.
   */
  static fromModel(
    user: User,
    selfieUrl: string | null = null,
    level: number | null = null
  ): AuthenticatedProfileResponseDto {
    const response = new AuthenticatedProfileResponseDto()
    response.id = user.usersUid
    response.firstname = user.firstname
    response.lastname = user.lastname
    response.phone = user.phone
    response.accountNumber = user.accountNumber
    response.accountType = user.accountType
    const kycStatus = statusOfFile(user.kycDocument)

    response.pictureUrl =
      kycStatus === AccountVerificationStatus.VERIFIED ? selfieUrl || user.pictureUrl || '' : ''
    response.status = user.status
    response.kycStatus = kycStatus
    response.kycLevel = level ?? 0
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
   *
   * @param {User} user - Utilisateur authentifié.
   * @param {string} token - Jeton d'accès.
   * @param {string | null} [selfieUrl] - Adresse consultable du selfie, résolue par l'appelant.
   * @param {number | null} [level] - Palier du compte, résolu par l'appelant.
   */
  static from(
    user: User,
    token: string,
    selfieUrl: string | null = null,
    level: number | null = null
  ): AuthenticatedProfileAndTokenResponseDto {
    const dto = new AuthenticatedProfileAndTokenResponseDto()
    dto.user = AuthenticatedProfileResponseDto.fromModel(user, selfieUrl, level)
    dto.token = token
    dto.type = 'Bearer'
    return dto
  }
}
