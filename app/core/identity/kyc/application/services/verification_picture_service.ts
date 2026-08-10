import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

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
    const document = await this.kycDocumentRepository.findByAccountId(accountId)

    if (!document) return null

    const selfie = document.pieces?.find((piece) => piece.pieceType === DocumentPieceType.SELFIE)

    if (selfie) {
      return this.fileStorageService.signedUrl(selfie.fileKey)
    }

    return document.selfieUrl ?? null
  }
}
