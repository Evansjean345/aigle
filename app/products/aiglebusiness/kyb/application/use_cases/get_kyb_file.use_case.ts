import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import AccountNotFoundException from '#core/identity/account/domain/exceptions/account_not_found_exception'
import { KybFileResponseDto } from '#aiglebusiness/kyb/application/dtos/kyb.dto'

/**
 * Consultation par l'entreprise de son propre dossier de vérification.
 */
@inject()
export default class GetKybFileUseCase {
  constructor(
    private readonly reviewService: BusinessReviewService,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Rend l'état du dossier d'une organisation.
   *
   * @param {string} organisationId - Organisation visée.
   * @returns {Promise<KybFileResponseDto>} Statut, pièces déposées et pièces attendues.
   * @throws {AccountNotFoundException} L'organisation n'a pas de compte.
   */
  async execute(organisationId: string): Promise<KybFileResponseDto> {
    const accountId = await this.accountStandingService.findAccountId(
      AccountOwnerType.ORGANISATION,
      organisationId
    )

    if (!accountId) throw new AccountNotFoundException()

    const account = await this.accountStandingService.describe(accountId)

    if (!account) throw new AccountNotFoundException()

    return KybFileResponseDto.fromDocument(
      account.verificationProfile,
      await this.reviewService.findByAccountId(accountId)
    )
  }
}
