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
}
