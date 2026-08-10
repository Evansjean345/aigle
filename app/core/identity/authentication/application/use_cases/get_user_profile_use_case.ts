import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import { AuthenticatedProfileResponseDto } from '#core/identity/authentication/application/dtos/profile.dto'
import VerificationPictureService from '#core/identity/kyc/application/services/verification_picture_service'

@inject()
export default class GetUserProfileUseCase {
  constructor(private readonly verificationPictureService: VerificationPictureService) {}

  /**
   * Charge le profil et rend la vue destinée à l'application.
   *
   * Le selfie d'un dossier récent vit sur le stockage privé : il est signé ici, à la lecture, plutôt
   * que servi depuis une colonne que la soumission n'écrit plus.
   *
   * @param {User} authenticated - Utilisateur authentifié.
   * @return {Promise<AuthenticatedProfileResponseDto>} Le profil, photo de vérification comprise.
   */
  async execute(authenticated: User): Promise<AuthenticatedProfileResponseDto> {
    await authenticated.load('country')
    await authenticated.load('kycDocument')

    const selfieUrl = await this.verificationPictureService.selfieUrlFor(authenticated.usersUid)

    return AuthenticatedProfileResponseDto.fromModel(authenticated, selfieUrl)
  }
}
