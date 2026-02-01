import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import KycMapper from '#features/kyc/application/mapper/kyc_mapper'
import { AdminKycListDto } from '#features/kyc/application/dto/kyc.dto'

@inject()
export default class GetAllKycDocumentsUseCase {
  /**
   * Constructs an instance of the class with the provided KycDocumentRepository.
   *
   * @param {KycDocumentRepository} kycDocumentRepository - The repository used to manage KYC documents.
   */
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Executes a query to fetch paginated KYC documents with optional filters.
   *
   * @param {number} page - The current page number for pagination.
   * @param {number} perPage - The number of items to include per page.
   * @param {Object} [filters] - Optional filters to narrow the query results.
   *
   * @return {Promise<{ meta: any; data: AdminKycListDto[] }>} A promise that resolves to an object containing pagination metadata and a list of KYC documents.
   */
  async execute(
    page: number,
    perPage: number,
    filters?: {
      status?: string
      documentType?: string
      userId?: string
      search?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<{ meta: any; data: AdminKycListDto[] }> {
    const paginatedKyc = await this.kycDocumentRepository.findAll(page, perPage, filters)

    return {
      meta: paginatedKyc.getMeta(),
      data: KycMapper.toAdminDtoList(paginatedKyc.all()),
    }
  }
}
