import KycDocument from '#features/kyc/domain/models/kyc_document'

export default abstract class KycDocumentRepository {
  /**
   * Check if user has submitted KYC documents
   * @param userId
   * @returns {Promise<KycDocument | null>}
   */
  abstract findUserKycDocument(userId: string): Promise<KycDocument | null>

  /**
   * Save KYC document
   * @param kycDocument
   */
  abstract saveKycDocument(kycDocument: KycDocument): Promise<KycDocument>

  /**
   * Find all KYC documents with pagination and filters
   * @param page
   * @param perPage
   * @param filters
   */
  abstract findAll(
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
  ): Promise<any>

  /**
   * Get KYC statistics
   */
  abstract getStats(): Promise<any>

  /**
   * Find KYC document by ID
   * @param id
   */
  abstract findById(id: number): Promise<KycDocument | null>

  /**
   * Get last attempt for a user and document type
   */
  abstract findLastAttempt(userId: string, documentType: string): Promise<any | null>

  /**
   * Save a KYC attempt
   */
  abstract saveAttempt(attempt: any): Promise<void>
}
