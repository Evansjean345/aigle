import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import { inject } from '@adonisjs/core'
import { KycDocumentResponseDto } from '#features/kyc/application/dto/kyc.dto'
import FileStorageService from '#shared/infrastructure/file_storage_service'
import { KycDocumentNextAction, KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import { Exception } from '@adonisjs/core/exceptions'

/**
 *
 * Use case class for submitting KYC documents for a user.
 */
@inject()
export default class SubmitKycSelfiUsecase {
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
   * @param kycSelfie
   * @returns {Promise<KycDocumentResponseDto>}
   */
  async execute(userId: string, kycSelfie: any): Promise<KycDocumentResponseDto> {
    if (!kycSelfie) {
      throw new Exception('Veuillez soumettre votre photo selfie', {
        status: 400,
        code: 'MISSING_SELFIE',
      })
    }

    const existingKyc = await this.kycDocumentRepository.findUserKycDocument(userId)

    if (!existingKyc) {
      throw new Exception("Vous n'avez pas encore soumis vos documents kyc", {
        status: 400,
        code: 'MISSING_KYC_DOCUMENTS',
      })
    }

    if ([KycDocumentStatus.APPROVED, KycDocumentStatus.PENDING].includes(existingKyc.status)) {
      throw new Exception('Vous avez déjà soumis vos documents kyc', {
        status: 400,
        code: 'ALREADY_SUBMITTED_KYC_DOCUMENTS',
      })
    }

    existingKyc.selfieUrl = await this.fileStorageService.uploadFile(
      kycSelfie,
      `kyc_selfies/${userId}`
    )

    existingKyc.status = KycDocumentStatus.PENDING
    existingKyc.nextAction = KycDocumentNextAction.IN_REVIEW

    await this.kycDocumentRepository.saveKycDocument(existingKyc)

    return {
      message: 'kyc selfie submitted successfully',
      nextAction: KycDocumentNextAction.IN_REVIEW,
    }
  }
}
