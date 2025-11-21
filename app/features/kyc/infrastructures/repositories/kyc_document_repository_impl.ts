import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import KycDocument from '#features/kyc/domain/models/kyc_document'

export default class KycDocumentRepositoryImpl implements KycDocumentRepository {
  /**
   * Check if user has submitted KYC documents
   * @param userId
   * @returns {Promise<KycDocument>}
   */
  async findUserKycDocument(userId: string): Promise<KycDocument | null> {
    return KycDocument.query().where('user_id', userId).first()
  }

  /**
   * Save KYC document
   * @param kycDocument
   */
  async saveKycDocument(kycDocument: KycDocument): Promise<KycDocument> {
    return kycDocument.save()
  }
}
