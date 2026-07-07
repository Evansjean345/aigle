import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import { KycDocumentRequestDto, KycDocumentResponseDto } from '#core/identity/kyc/application/dto/kyc.dto'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import KycAlreadySubmittedException from '#core/identity/kyc/domain/exceptions/kyc_already_submitted_exception'
import MissingKycDocumentsException from '#core/identity/kyc/domain/exceptions/missing_kyc_documents_exception'

import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'
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
    const existingKyc = await this.kycDocumentRepository.findUserKycDocument(userId)

    if (
      existingKyc &&
      [KycDocumentStatus.APPROVED, KycDocumentStatus.PENDING].includes(existingKyc.status)
    ) {
      throw new KycAlreadySubmittedException()
    }

    try {
      const { rectoUrl, versoUrl, selfiUrl } = await this.uploadDocumentFiles(
        kycDocument.documentRectoUrl,
        kycDocument.documentVersoUrl,
        kycDocument.documentsSelfieUrl,
        userId,
        kycDocument.documentType
      )

      if (existingKyc) {
        existingKyc.documentType = kycDocument.documentType
        existingKyc.documentRectoUrl = rectoUrl
        existingKyc.documentVersoUrl = versoUrl
        existingKyc.selfieUrl = selfiUrl
        existingKyc.status = KycDocumentStatus.PENDING
        existingKyc.comment = undefined
        existingKyc.agentId = null

        await this.kycDocumentRepository.saveKycDocument(existingKyc)
      } else {
        const newKycDocument = new KycDocument()

        newKycDocument.userId = userId
        newKycDocument.documentType = kycDocument.documentType
        newKycDocument.documentRectoUrl = rectoUrl
        newKycDocument.documentVersoUrl = versoUrl
        newKycDocument.selfieUrl = selfiUrl
        newKycDocument.status = KycDocumentStatus.PENDING
        newKycDocument.agentId = null

        await this.kycDocumentRepository.saveKycDocument(newKycDocument)
      }

      // Enregistrement de la tentative dans l'historique
      const lastAttempt = await this.kycDocumentRepository.findLastAttempt(
        userId,
        kycDocument.documentType
      )

      const attemptNumber = (lastAttempt?.attemptNumber || 0) + 1

      const newAttempt = new KycAttemp()
      newAttempt.userId = userId
      const currentKyc =
        existingKyc || (await this.kycDocumentRepository.findUserKycDocument(userId))
      if (!currentKyc) throw new KycDocumentNotFoundException()

      newAttempt.kycDocumentId = currentKyc.id
      newAttempt.documentType = kycDocument.documentType
      newAttempt.documentRectoUrl = rectoUrl
      newAttempt.documentVersoUrl = versoUrl
      newAttempt.selfieUrl = selfiUrl
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
   * Uploads the provided document files (front side, back side, and selfie) to the file storage service specific to the user's ID.
   *
   * @param {any} recto - The file representing the front side of the ID document.
   * @param {any} verso - The file representing the back side of the ID document.
   * @param {any} selfie - The file representing the user's selfie image.
   * @param {string} userId - The unique identifier of the user for whom the files are being uploaded.
   * @param {string} documentType - The type of document being uploaded.
   * @return {Promise<{rectoUrl: string, versoUrl: string, selfiUrl: string}>} A promise that resolves to an object containing the URLs of the uploaded files.
   * @throws {Exception} If any of the required files (recto, verso, or selfie) are missing based on the document type.
   */
  private async uploadDocumentFiles(
    recto: any,
    verso: any,
    selfie: any,
    userId: string,
    documentType: string
  ): Promise<{ rectoUrl: string; versoUrl: string; selfiUrl: string }> {
    const isPassport = documentType === 'PASSPORT'

    if (!recto || (!isPassport && !verso) || !selfie) {
      const message = isPassport
        ? 'Veuillez télécharger le recto de votre passeport et une photo selfie de vous'
        : 'Veuillez télécharger le recto, le verso de votre pièce ainsi qu’une photo (selfie) de vous'
      throw new MissingKycDocumentsException(message)
    }

    const uploadPromises = [
      await this.fileStorageService.uploadFile(recto, `kyc_documents/${userId}`),
      verso
        ? await this.fileStorageService.uploadFile(verso, `kyc_documents/${userId}`)
        : await Promise.resolve(''),
      await this.fileStorageService.uploadFile(selfie, `kyc_selfies/${userId}`),
    ]

    const [rectoUrl, versoUrl, selfiUrl] = await Promise.all(uploadPromises)

    return { rectoUrl, versoUrl, selfiUrl }
  }
}
