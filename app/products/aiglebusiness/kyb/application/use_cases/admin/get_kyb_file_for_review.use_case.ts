import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import type { BusinessReviewResult } from '#core/identity/kyc/application/dtos/admin/admin_business_review.dto'

/** Détail d'un dossier d'entreprise, tel que le gestionnaire le consulte. */
@inject()
export default class GetKybFileForReviewUseCase {
  constructor(private readonly reviewService: BusinessReviewService) {}

  /**
   * Charge le dossier, ses pièces signées et le niveau de son compte.
   *
   * @param {number} id - Identifiant du dossier.
   * @returns {Promise<BusinessReviewResult | null>} Le dossier, ou `null` s'il n'existe pas.
   */
  async execute(id: number): Promise<BusinessReviewResult | null> {
    return this.reviewService.findForReview(id)
  }
}
