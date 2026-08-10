import { inject } from '@adonisjs/core'
import {
  KycDocumentRequestDto,
  KycDocumentResponseDto,
} from '#core/identity/kyc/application/dtos/kyc.dto'
import AccountVerificationService from '#core/identity/kyc/application/services/account_verification_service'
import type { SubmitPieceCommand } from '#core/identity/kyc/application/dtos/account_verification.dto'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import IncompleteVerificationFileException from '#core/identity/kyc/domain/exceptions/incomplete_verification_file_exception'
import MissingKycDocumentsException from '#core/identity/kyc/domain/exceptions/missing_kyc_documents_exception'
import kycLog from '#shared/infrastructure/logging/kyc_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

/**
 * Soumission des pièces d'identité depuis l'application mobile.
 *
 * Traduit le contrat de l'application — trois fichiers nommés — en pièces typées, délègue au service
 * de vérification, puis journalise et annonce la soumission.
 */
@inject()
export default class SubmitKycDocumentUsecase {
  constructor(private readonly accountVerificationService: AccountVerificationService) {}

  /**
   * Soumet les pièces d'identité d'un utilisateur.
   *
   * Pour un compte utilisateur, `account_id == usersUid` : l'identifiant reçu sert de compte.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {KycDocumentRequestDto} kycDocument - Fichiers déposés et nature de la pièce.
   * @returns {Promise<KycDocumentResponseDto>} Le message de confirmation.
   * @throws {MissingKycDocumentsException} Un fichier requis manque.
   * @throws {KycAlreadySubmittedException} Un dossier est déjà en revue ou approuvé.
   */
  async execute(
    userId: string,
    kycDocument: KycDocumentRequestDto
  ): Promise<KycDocumentResponseDto> {
    try {
      await this.accountVerificationService.submit({
        accountId: userId,
        documentType: kycDocument.documentType,
        pieces: this.toPieces(kycDocument),
      })

      kycLog.info(
        'KYC_DOCUMENT_SUBMITTED',
        { user_id: userId, document_type: kycDocument.documentType },
        'KYC documents submitted successfully'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'KYC',
          eventAction: 'DOCUMENT_SUBMITTED',
          actorId: userId,
          actorType: 'User',
          targetType: 'AccountVerification',
          targetId: userId,
          result: AuditResult.SUCCESS,
          ipAddress: kycDocument.ipAddress ?? null,
          userAgent: kycDocument.userAgent ?? null,
          requestId: kycDocument.requestId ?? null,
          metadata: {
            documentType: kycDocument.documentType,
            status: KycDocumentStatus.PENDING,
            geoCountry: kycDocument.geoLocation?.countryCode ?? null,
            geoCity: kycDocument.geoLocation?.city ?? null,
            isVpn: kycDocument.geoLocation?.isVpn ?? null,
          },
        })
        .catch((_) => {})

      await KycDocumentSubmitted.dispatch(userId, KycDocumentStatus.PENDING, {
        ipAddress: kycDocument.ipAddress ?? null,
        userAgent: kycDocument.userAgent ?? null,
        requestId: kycDocument.requestId ?? null,
        geoLocation: kycDocument.geoLocation,
      })

      return { message: 'Documents Kyc soumis avec succès 📄' }
    } catch (error) {
      errorLog.error(
        'KYC_SUBMISSION_ERROR',
        {
          user_id: userId,
          document_type: kycDocument.documentType,
          error: error.message,
        },
        'Failed to submit KYC documents'
      )

      throw this.asMobileError(error, kycDocument.documentType)
    }
  }

  /**
   * Traduit les fichiers du contrat mobile en pièces typées.
   *
   * Un fichier absent n'est pas déposé : c'est le catalogue de complétude qui décide s'il manquait.
   *
   * @param {KycDocumentRequestDto} kycDocument - Fichiers déposés.
   * @returns {SubmitPieceCommand[]} Les pièces à soumettre.
   */
  private toPieces(kycDocument: KycDocumentRequestDto): SubmitPieceCommand[] {
    const candidates: [DocumentPieceType, any][] = [
      [DocumentPieceType.RECTO, kycDocument.documentRectoUrl],
      [DocumentPieceType.VERSO, kycDocument.documentVersoUrl],
      [DocumentPieceType.SELFIE, kycDocument.documentsSelfieUrl],
    ]

    return candidates
      .filter(([, file]) => Boolean(file))
      .map(([pieceType, file]) => ({ pieceType, file }))
  }

  /**
   * Rend l'erreur telle que l'application mobile la connaît.
   *
   * Le dossier incomplet remonte du service sous une forme générique ; l'application attend le
   * message et le code historiques, qui distinguent le passeport des autres pièces.
   *
   * @param {unknown} error - Erreur levée par le service.
   * @param {string} documentType - Nature de la pièce déposée.
   * @returns {unknown} L'erreur à propager.
   */
  private asMobileError(error: unknown, documentType: string): unknown {
    if (!(error instanceof IncompleteVerificationFileException)) return error

    const message =
      documentType === 'PASSPORT'
        ? 'Veuillez télécharger le recto de votre passeport et une photo selfie de vous'
        : 'Veuillez télécharger le recto, le verso de votre pièce ainsi qu’une photo (selfie) de vous'

    return new MissingKycDocumentsException(message)
  }
}
