import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { AdminKybReviewDto } from '#aiglebusiness/kyb/application/dtos/admin/admin_kyb_review.dto'

/**
 * Détail d'un dossier d'entreprise, tel que le gestionnaire le consulte.
 *
 * Compose deux lectures : le core rend le dossier, ses pièces signées et le niveau du compte ; le
 * produit y ajoute l'entreprise, que le core ne connaît pas.
 */
@inject()
export default class GetKybFileForReviewUseCase {
  constructor(
    private readonly reviewService: BusinessReviewService,
    private readonly organisations: OrganisationRepository
  ) {}

  /**
   * Charge le dossier, ses pièces signées, le niveau de son compte et son entreprise.
   *
   * @param {number} id - Identifiant du dossier.
   * @returns {Promise<AdminKybReviewDto | null>} Le dossier, ou `null` s'il n'existe pas.
   */
  async execute(id: number): Promise<AdminKybReviewDto | null> {
    const review = await this.reviewService.findForReview(id)

    if (!review) return null

    // Le compte d'une organisation porte l'identifiant de celle-ci (`accountId == ownerRef`).
    const organisation = await this.organisations.findByOrganisationId(review.document.accountId)

    return AdminKybReviewDto.fromReview(review, organisation ?? undefined)
  }
}
