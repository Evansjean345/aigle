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
   * Submit KYC documents for a user
   *
   * @param userId
   * @param kycDocument
   * @returns {Promise<KycDocumentResponseDto>}
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

    const { rectoUrl, versoUrl } = await this.uploadDocumentFiles(
      kycDocument.documentRectoUrl,
      kycDocument.documentVersoUrl,
      userId
    )

    if (existingKyc) {
      existingKyc.documentType = kycDocument.documentType
      existingKyc.documentRectoUrl = rectoUrl
      existingKyc.documentVersoUrl = versoUrl
      existingKyc.nextAction = KycDocumentNextAction.SELFIE
      existingKyc.status = KycDocumentStatus.IN_SUBMISSION

      await this.kycDocumentRepository.saveKycDocument(existingKyc)
    } else {
      const newKycDocument = new KycDocument()

      newKycDocument.userId = userId
      newKycDocument.nextAction = KycDocumentNextAction.SELFIE
      newKycDocument.documentType = kycDocument.documentType
      newKycDocument.documentRectoUrl = rectoUrl
      newKycDocument.documentVersoUrl = versoUrl
      newKycDocument.status = KycDocumentStatus.IN_SUBMISSION

      await this.kycDocumentRepository.saveKycDocument(newKycDocument)
    }

    return {
      message: 'kyc documents submitted successfully',
      nextAction: KycDocumentNextAction.SELFIE,
    }
  }

  /**
   * Uploads document files (recto and verso) to the file storage service for the specified user.
   *
   * @param recto The front side of the document to be uploaded.
   * @param verso The back side of the document to be uploaded.
   * @param userId The unique identifier of the user to associate the uploaded files with.
   * @return A Promise that resolves to an object containing the URLs of the uploaded recto and verso files.
   */
  private async uploadDocumentFiles(
    recto: any,
    verso: any,
    userId: string
  ): Promise<{ rectoUrl: string; versoUrl: string }> {
    if (!recto || !verso) {
      throw new Exception('Please upload both front and back of your ID', {
        status: 400,
        code: 'MISSING_KYC_DOCUMENTS',
      })
    }

    const [rectoUrl, versoUrl] = await Promise.all([
      this.fileStorageService.uploadFile(recto, `kyc_documents/${userId}`),
      this.fileStorageService.uploadFile(verso, `kyc_documents/${userId}`),
    ])
    return { rectoUrl, versoUrl }
  }
}
