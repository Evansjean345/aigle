import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import { KycStatsDto } from '#features/kyc/application/dto/kyc.dto'

@inject()
export default class GetKycStatsUseCase {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Executes the use case to retrieve KYC statistics.
   *
   * @return {Promise<KycStatsDto>} A promise that resolves to KYC statistics.
   */
  async execute(): Promise<KycStatsDto> {
    return await this.kycDocumentRepository.getStats()
  }
}
