import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import {
  KycDocumentRequestDto,
  KycDocumentResponseDto,
} from '#core/identity/kyc/application/dtos/kyc.dto'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { DocumentPieceType, KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import type { DocumentPieceInput } from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import KycAlreadySubmittedException from '#core/identity/kyc/domain/exceptions/kyc_already_submitted_exception'
import MissingKycDocumentsException from '#core/identity/kyc/domain/exceptions/missing_kyc_documents_exception'

import kycLog from '#shared/infrastructure/logging/kyc_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

/**
 *
 * Use case class for submitting KYC documents for a user.
 */
@inject()
export default class SubmitKycDocumentUsecase {
  /**
   * Constructor
   *
   * @param kycDocumentRepository
   * @param fileStorageService
   */
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly fileStorageService: FileStorageService
  ) {}

  /**
   * Submits KYC (Know Your Customer) documents for a given user.
   *
   * @param {string} userId - The unique identifier of the user submitting KYC documents.
   * @param {KycDocumentRequestDto} kycDocument - The details of the KYC document including URLs for document images and type.
   * @return {Promise<KycDocumentResponseDto>} A promise resolving to a response object that contains the submission status and next action.
   * @throws {Exception} If the user has already submitted KYC documents in an approved or pending state.
   */
  async execute(
    userId: string,
    kycDocument: KycDocumentRequestDto
  ): Promise<KycDocumentResponseDto> {
    const existingKyc = await this.kycDocumentRepository.findByAccountId(userId)

    if (
      existingKyc &&
      [KycDocumentStatus.APPROVED, KycDocumentStatus.PENDING].includes(existingKyc.status)
    ) {
      throw new KycAlreadySubmittedException()
    }

    try {
      const pieces = await this.uploadDocumentPieces(
        kycDocument.documentRectoUrl,
        kycDocument.documentVersoUrl,
        kycDocument.documentsSelfieUrl,
        userId,
        kycDocument.documentType
      )

      const document = existingKyc ?? new KycDocument()

      document.accountId = userId
      document.userId = userId
      document.ownerType = AccountOwnerType.USER
      document.documentType = kycDocument.documentType
      document.status = KycDocumentStatus.PENDING
      document.comment = undefined
      document.agentId = null

      const currentKyc = await this.kycDocumentRepository.saveWithPieces(document, pieces)

      // Enregistrement de la tentative dans l'historique
      const lastAttempt = await this.kycDocumentRepository.findLastAttempt(currentKyc.id)

      const attemptNumber = (lastAttempt?.attemptNumber || 0) + 1

      const keyOf = (pieceType: DocumentPieceType) =>
        pieces.find((piece) => piece.pieceType === pieceType)?.fileKey

      const newAttempt = new KycAttemp()
      newAttempt.userId = userId
      newAttempt.accountId = userId

      newAttempt.kycDocumentId = currentKyc.id
      newAttempt.documentType = kycDocument.documentType
      newAttempt.documentRectoUrl = keyOf(DocumentPieceType.RECTO)
      newAttempt.documentVersoUrl = keyOf(DocumentPieceType.VERSO)
      newAttempt.selfieUrl = keyOf(DocumentPieceType.SELFIE)
      newAttempt.attemptNumber = attemptNumber
      newAttempt.status = KycDocumentStatus.PENDING
      newAttempt.agentId = null

      await this.kycDocumentRepository.saveAttempt(newAttempt)

      kycLog.info(
        'KYC_DOCUMENT_SUBMITTED',
        {
          user_id: userId,
          document_type: kycDocument.documentType,
          attempt_number: attemptNumber,
        },
        'KYC documents submitted successfully'
      )

      emitter
        .emit('activity:audit', {
          eventCategory: 'KYC',
          eventAction: 'DOCUMENT_SUBMITTED',
          actorId: userId,
          actorType: 'User',
          targetType: 'KycDocument',
          targetId: String(currentKyc.id),
          result: AuditResult.SUCCESS,
          ipAddress: kycDocument.ipAddress ?? null,
          userAgent: kycDocument.userAgent ?? null,
          requestId: kycDocument.requestId ?? null,
          metadata: {
            documentType: kycDocument.documentType,
            attemptNumber,
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

      return {
        message: 'Documents Kyc soumis avec succès 📄',
      }
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
      throw error
    }
  }

  /**
   * Dépose les fichiers sur le stockage privé et en compose les pièces du dossier.
   *
   * Chaque pièce porte la clé de l'objet déposé : la consultation passe par une URL signée générée à
   * la lecture. Un passeport n'a pas de verso.
   *
   * @param {any} recto - Fichier du recto de la pièce.
   * @param {any} verso - Fichier du verso, absent pour un passeport.
   * @param {any} selfie - Photo du porteur.
   * @param {string} accountId - Compte auquel le dossier se rattache.
   * @param {string} documentType - Nature de la pièce d'identité.
   * @return {Promise<DocumentPieceInput[]>} Les pièces à écrire.
   * @throws {MissingKycDocumentsException} Un fichier requis manque.
   */
  private async uploadDocumentPieces(
    recto: any,
    verso: any,
    selfie: any,
    accountId: string,
    documentType: string
  ): Promise<DocumentPieceInput[]> {
    const isPassport = documentType === 'PASSPORT'

    if (!recto || (!isPassport && !verso) || !selfie) {
      const message = isPassport
        ? 'Veuillez télécharger le recto de votre passeport et une photo selfie de vous'
        : 'Veuillez télécharger le recto, le verso de votre pièce ainsi qu’une photo (selfie) de vous'
      throw new MissingKycDocumentsException(message)
    }

    const documentFolder = `kyc_documents/${accountId}`
    const pieces: DocumentPieceInput[] = [
      {
        pieceType: DocumentPieceType.RECTO,
        fileKey: await this.fileStorageService.uploadPrivateFile(recto, documentFolder),
      },
    ]

    if (verso) {
      pieces.push({
        pieceType: DocumentPieceType.VERSO,
        fileKey: await this.fileStorageService.uploadPrivateFile(verso, documentFolder),
      })
    }

    pieces.push({
      pieceType: DocumentPieceType.SELFIE,
      fileKey: await this.fileStorageService.uploadPrivateFile(selfie, `kyc_selfies/${accountId}`),
    })

    return pieces
  }
}
