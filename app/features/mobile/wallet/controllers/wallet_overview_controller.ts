import GetUserWalletOverviewUseCase from '#mobile/wallet/use_cases/get_user_wallet_overview_use_case'
import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'

/**
 * Controller responsible for handling wallet overview-related operations.
 */
@inject()
export default class WalletOverviewController {
  /**
   * Constructs an instance of the class with the necessary dependencies.
   *
   * @param {GetUserWalletOverviewUseCase} getWalletOverviewUseCase - The use case for retrieving user wallet overview.
   */
  constructor(private readonly getWalletOverviewUseCase: GetUserWalletOverviewUseCase) {}

  /**
   * Handles the request to retrieve wallet overview for an authenticated user.
   *
   * @param {Object} context - The HTTP context object containing request, response, and authentication details.
   * @param {Object} context.response - The HTTP response object.
   * @param {Object} context.auth - The authentication object containing user details.
   * @return {Promise<void>} - A promise resolving to the response object containing the wallet overview data.
   */
  async handle({ response, auth }: HttpContext): Promise<void> {
    const authenticatedUser = auth.user!
    const overview = await this.getWalletOverviewUseCase.execute(authenticatedUser.usersUid)
    return response.ok(overview)
  }
}
