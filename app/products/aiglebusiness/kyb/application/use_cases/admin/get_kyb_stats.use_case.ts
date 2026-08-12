import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import type { BusinessReviewStatsResult } from '#core/identity/kyc/application/dtos/admin/admin_business_review.dto'

/** Compteurs de la file de revue des entreprises, pour le back-office. */
@inject()
export default class GetKybStatsUseCase {
  constructor(private readonly reviewService: BusinessReviewService) {}

  /**
   * Rend le nombre de dossiers par statut.
   *
   * @returns {Promise<BusinessReviewStatsResult>} Les compteurs de la file.
   */
  async execute(): Promise<BusinessReviewStatsResult> {
    return this.reviewService.stats()
  }
}
