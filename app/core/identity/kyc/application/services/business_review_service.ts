import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import {
  toKycDocumentResult,
  type KycDocumentResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Consultation des dossiers d'entreprise.
 *
 * Ne sert que les dossiers de comptes d'organisation : ceux d'identité relèvent de leur propre
 * écran. La décision, elle, est commune aux deux — `VerificationDecisionService` la porte.
 */
@inject()
export default class BusinessReviewService {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Charge le dossier de vérification d'un compte d'organisation.
   *
   * @param {string} accountId - Compte porteur du dossier.
   * @returns {Promise<KycDocumentResult | null>} Le dossier, ou `null` s'il n'en existe pas.
   */
  async findByAccountId(accountId: string): Promise<KycDocumentResult | null> {
    const document = await this.kycDocumentRepository.findByAccountId(accountId)

    return document ? toKycDocumentResult(document) : null
  }
}
