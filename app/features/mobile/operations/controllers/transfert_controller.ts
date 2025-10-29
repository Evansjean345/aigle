import { HttpContext } from '@adonisjs/core/http'
import { transfertValidator } from '#mobile/operations/validators/transfert_validator'
import TransfertUseCase from '#mobile/operations/use_cases/transfert.usecase'
import { inject } from '@adonisjs/core'
import { toTransfertDto } from '#mobile/operations/mappers/transfert.mapper'
import WalletToWalletUseCase from '#mobile/operations/use_cases/wallet_to_wallet.use_case'

@inject()
export default class TransfertController {
  /**
   * Constructor for initializing the class with required use cases.
   *
   * @param {TransfertUseCase} transfertUseCase - An instance of TransfertUseCase to handle transfer operations.
   * @param {WalletToWalletUseCase} walletTowalletUseCase - An instance of WalletToWalletUseCase to handle wallet-to-wallet transactions.
   */
  constructor(
    private readonly transfertUseCase: TransfertUseCase,
    private readonly walletTowalletUseCase: WalletToWalletUseCase
  ) {}

  /**
   * Handles the user transaction process by validating the input, executing the transfer operation,
   * and sending the result as a response.
   *
   * @param {Object} HttpContext - The HTTP context for the request.
   * @param {Object} HttpContext.request - The HTTP request object containing client data.
   * @param {Object} HttpContext.response - The HTTP response object for sending data back to the client.
   * @param {Object} HttpContext.auth - The authentication object containing the authenticated user.
   * @return {Promise<void>} The HTTP response containing the result of the transfer operation.
   */
  async handle({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const payload = await request.validateUsing(transfertValidator)

    const paymentMethod = payload.payment_method_code

    switch (paymentMethod) {
      case 'mobile_money':
        const result = await this.transfertUseCase.execute(toTransfertDto(payload), user)
        return response.ok(result)
      case 'wallet':
        const data = { amount: payload.amount, recipient_phone: payload.phone }
        const walletTOWalletResult = await this.walletTowalletUseCase.execute(
          data,
          user,
          'by_phone'
        )
        return response.ok(walletTOWalletResult)

      default:
        return response.badRequest({ message: 'Payment method not supported' })
    }
  }
}
