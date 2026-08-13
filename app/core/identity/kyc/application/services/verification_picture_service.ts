import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'

/**
 * Sert le selfie d'un dossier de vérification comme photo de profil.
 *
 * Le selfie d'un dossier récent est une pièce sur stockage privé : il se consulte par une URL signée
 * générée ici, à la lecture. Un dossier antérieur à la bascule porte encore une URL publique, servie
 * telle quelle.
 *
 * Ne rend qu'une chaîne : ni modèle, ni pièce, ni clé de stockage.
 */
@inject()
export default class VerificationPictureService {
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly fileStorageService: FileStorageService
  ) {}

  /**
   * Rend l'adresse consultable du selfie d'un compte.
   *
   * @param {string} accountId - Compte porteur du dossier.
   * @returns {Promise<string | null>} L'adresse, ou `null` si le compte n'a pas de selfie.
   */
  async selfieUrlFor(accountId: string): Promise<string | null> {
    const selfies = await this.selfieUrlsFor([accountId])

    return selfies.get(accountId) ?? null
  }

  /**
   * Rend l'adresse consultable du selfie de plusieurs comptes, en une lecture.
   *
   * @param {string[]} accountIds - Comptes dont on cherche le selfie.
   * @returns {Promise<Map<string, string>>} L'adresse par compte, comptes sans selfie omis.
   */
  async selfieUrlsFor(accountIds: string[]): Promise<Map<string, string>> {
    const selfies = await this.kycDocumentRepository.findSelfiePiecesByAccountIds(accountIds)

    const resolved = await Promise.all(
      [...selfies].map(async ([accountId, selfie]) => {
        const url = selfie.isPublicUrl
          ? selfie.fileKey
          : await this.fileStorageService.signedUrl(selfie.fileKey)

        return [accountId, url] as const
      })
    )

    return new Map(resolved)
  }
}
