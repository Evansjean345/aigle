import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import UpdateWalletStatusUseCase from '#features/wallet/application/use_cases/admin/update_wallet_status_use_case'
import { WalletStatus } from '#features/wallet/domain/enum/wallet_status'

@inject()
export default class AdminWalletController {
  /**
   * Constructs an instance of the class.
   *
   * @param {UpdateWalletStatusUseCase} updateWalletStatusUseCase - The use case responsible for updating the wallet status.
   */
  constructor(private readonly updateWalletStatusUseCase: UpdateWalletStatusUseCase) {}

  /**
   * Activates a wallet by updating its status to active.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The parameters from the request.
   * @param {string} context.params.userId - The ID of the user whose wallet is being activated.
   * @param {Object} context.response - The response object used to send a response back.
   * @return {Promise<void>} The response indicating the wallet activation result.
   */
  async activate({ params, response }: HttpContext): Promise<void> {
    const { userId } = params
    await this.updateWalletStatusUseCase.execute({
      userId,
      status: WalletStatus.Active,
    })
    return response.ok({ message: 'Wallet activated successfully' })
  }

  /**
   * Deactivates a wallet by setting its status to inactive.
   *
   * @param {Object} context - The context object containing request and response data.
   * @param {Object} context.params - The parameters extracted from the request.
   * @param {string} context.params.userId - The ID of the user whose wallet is to be deactivated.
   * @param {Object} context.response - The response object to send the result.
   * @return {Promise<void>} Returns a response indicating the wallet was successfully deactivated.
   */
  async deactivate({ params, response }: HttpContext): Promise<void> {
    const { userId } = params
    await this.updateWalletStatusUseCase.execute({
      userId,
      status: WalletStatus.Inactive,
    })
    return response.ok({ message: 'Wallet deactivated successfully' })
  }
}
