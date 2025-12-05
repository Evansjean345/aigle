import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import {
  KycDocumentRequestDto,
  KycDocumentResponseDto,
} from '#features/kyc/application/dto/kyc.dto'
import FileStorageService from '#shared/infrastructure/file_storage_service'
import { KycDocumentNextAction, KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import { Exception } from '@adonisjs/core/exceptions'
import KycDocument from '#features/kyc/domain/models/kyc_document'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'

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
      throw new Exception('Vous avez déjà soumis vos documents kyc', {
        status: 400,
        code: 'ALREADY_SUBMITTED_KYC_DOCUMENTS',
      })
    }

    const { rectoUrl, versoUrl, selfiUrl } = await this.uploadDocumentFiles(
      kycDocument.documentRectoUrl,
      kycDocument.documentVersoUrl,
      kycDocument.documentsSelfieUrl,
      userId
    )

    if (existingKyc) {
      existingKyc.documentType = kycDocument.documentType
      existingKyc.documentRectoUrl = rectoUrl
      existingKyc.documentVersoUrl = versoUrl
      existingKyc.selfieUrl = selfiUrl
      existingKyc.status = KycDocumentStatus.PENDING

      await this.kycDocumentRepository.saveKycDocument(existingKyc)
    } else {
      const newKycDocument = new KycDocument()

      newKycDocument.userId = userId
      newKycDocument.documentType = kycDocument.documentType
      newKycDocument.documentRectoUrl = rectoUrl
      newKycDocument.documentVersoUrl = versoUrl
      newKycDocument.selfieUrl = selfiUrl
      newKycDocument.status = KycDocumentStatus.PENDING

      await this.kycDocumentRepository.saveKycDocument(newKycDocument)
    }

    await KycDocumentSubmitted.dispatch(userId, KycDocumentStatus.PENDING)

    return {
      message: 'kyc documents submitted successfully',
      nextAction: KycDocumentNextAction.SELFIE,
    }
  }

  /**
   * Uploads the provided document files (front side, back side, and selfie) to the file storage service specific to the user's ID.
   *
   * @param {any} recto - The file representing the front side of the ID document.
   * @param {any} verso - The file representing the back side of the ID document.
   * @param {any} selfie - The file representing the user's selfie image.
   * @param {string} userId - The unique identifier of the user for whom the files are being uploaded.
   * @return {Promise<{rectoUrl: string, versoUrl: string}>} A promise that resolves to an object containing the URLs of the uploaded recto (front side) and verso (back side) files.
   * @throws {Exception} If any of the required files (recto, verso, or selfie) are missing.
   */
  private async uploadDocumentFiles(
    recto: any,
    verso: any,
    selfie: any,
    userId: string
  ): Promise<{ rectoUrl: string; versoUrl: string; selfiUrl: string }> {
    if (!recto || !verso || !selfie) {
      throw new Exception('Please upload both front and back and selfi of your ID', {
        status: 400,
        code: 'MISSING_KYC_DOCUMENTS',
      })
    }

    const [rectoUrl, versoUrl, selfiUrl] = await Promise.all([
      this.fileStorageService.uploadFile(recto, `kyc_documents/${userId}`),
      this.fileStorageService.uploadFile(verso, `kyc_documents/${userId}`),
      this.fileStorageService.uploadFile(selfie, `kyc_selfies/${userId}`),
    ])
    return { rectoUrl, versoUrl, selfiUrl }
  }
}
