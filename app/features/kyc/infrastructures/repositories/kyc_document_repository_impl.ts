import KycDocumentRepository from '#features/kyc/domain/imterfaces/kyc_document_repository'
import KycDocument from '#features/kyc/domain/models/kyc_document'

/**
 * An implementation of the `KycDocumentRepository` interface that provides methods
 * for interacting with KYC (Know Your Customer) documents in the database.
 */
export default class KycDocumentRepositoryImpl implements KycDocumentRepository {
  /**
   * Retrieves the KYC (Know Your Customer) document associated with a specific user.
   *
   * @param {string} userId - The unique identifier of the user whose KYC document is to be retrieved.
   * @return {Promise<KycDocument | null>} A promise that resolves to the KYC document of the user if found, or null if no document exists for the user.
   */
  async findUserKycDocument(userId: string): Promise<KycDocument | null> {
    return KycDocument.query().where('user_id', userId).first()
  }

  /**
   * Saves a KYC (Know Your Customer) document to the database.
   *
   * @param {KycDocument} kycDocument - The KYC document to be saved.
   * @return {Promise<KycDocument>} A promise that resolves to the saved KYC document.
   */
  async saveKycDocument(kycDocument: KycDocument): Promise<KycDocument> {
    return kycDocument.save()
  }
}
