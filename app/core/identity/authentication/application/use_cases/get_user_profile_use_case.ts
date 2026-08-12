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
   * Le selfie d'un dossier récent vit sur le stockage privé : il est signé ici, à la lecture, plutôt
   * que servi depuis une colonne que la soumission n'écrit plus. Le palier vient du compte, seule
   * source de vérité depuis le retrait de la copie portée par `users`.
   *
   * @param {User} authenticated - Utilisateur authentifié.
   * @return {Promise<AuthenticatedProfileResponseDto>} Le profil, photo de vérification comprise.
   */
  async execute(authenticated: User): Promise<AuthenticatedProfileResponseDto> {
    await authenticated.load('country')
    await authenticated.load('kycDocument')

    const [selfieUrl, account] = await Promise.all([
      this.verificationPictureService.selfieUrlFor(authenticated.usersUid),
      this.accountStanding.describe(authenticated.usersUid),
    ])

    return AuthenticatedProfileResponseDto.fromModel(authenticated, selfieUrl, account?.level ?? null)
  }
}
