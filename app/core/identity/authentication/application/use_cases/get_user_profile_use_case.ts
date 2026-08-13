import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import { AuthenticatedProfileResponseDto } from '#core/identity/authentication/application/dtos/profile.dto'
import VerificationPictureService from '#core/identity/kyc/application/services/verification_picture_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'

@inject()
export default class GetUserProfileUseCase {
  constructor(
    private readonly verificationPictureService: VerificationPictureService,
    private readonly accountStanding: AccountStandingService
  ) {}

  /**
   * Charge le profil et rend la vue destinée à l'application.
   *
   * Le selfie vit sur le stockage privé : son adresse est signée à la lecture. Le palier vient du
   * compte, et le statut de vérification du dossier chargé ici.
   *
   * @param {User} authenticated - Utilisateur authentifié.
   * @return {Promise<AuthenticatedProfileResponseDto>} Le profil, photo de vérification comprise.
   */
  async execute(authenticated: User): Promise<AuthenticatedProfileResponseDto> {
    const [, , selfieUrl, account] = await Promise.all([
      authenticated.load('country'),
      authenticated.load('kycDocument'),
      this.verificationPictureService.selfieUrlFor(authenticated.usersUid),
      this.accountStanding.describe(authenticated.usersUid),
    ])

    return AuthenticatedProfileResponseDto.fromModel(
      authenticated,
      selfieUrl,
      account?.level ?? null
    )
  }
}
