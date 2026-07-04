import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/kyc/domain/interfaces/kyc_document_repository'
import { AdminKycListDto } from '#core/kyc/application/dto/kyc.dto'

@inject()
export default class GetUserKycDocumentUseCase {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Executes the process to retrieve the KYC document for a specific user and maps it to an AdminKycListDto.
   *
   * @param {string} userId - The unique identifier of the user whose KYC document is to be retrieved.
   * @return {Promise<AdminKycListDto | null>} A promise that resolves to the mapped AdminKycListDto if the KYC document is found, or null if no document exists.
   */
  async execute(userId: string): Promise<AdminKycListDto | null> {
    const kycDocument = await this.kycDocumentRepository.findUserKycDocument(userId)

    if (!kycDocument) {
      return null
    }

    return AdminKycListDto.fromKycDocument(kycDocument)
  }
}
