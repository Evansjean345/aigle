import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#features/kyc/domain/interfaces/kyc_document_repository'
import { AdminKycListDto } from '#features/kyc/application/dto/kyc.dto'

@inject()
export default class GetKycDocumentByIdUseCase {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Executes the use case to retrieve a KYC document by its ID.
   *
   * @param {number} id - The ID of the KYC document.
   * @return {Promise<AdminKycListDto | null>} A promise that resolves to the KYC document DTO or null if not found.
   */
  async execute(id: number): Promise<AdminKycListDto | null> {
    const kycDocument = await this.kycDocumentRepository.findById(id)

    if (!kycDocument) {
      return null
    }

    return AdminKycListDto.fromKycDocument(kycDocument)
  }
}
