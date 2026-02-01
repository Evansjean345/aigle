import { HttpContext } from '@adonisjs/core/http'
import { transfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import TransfertUseCase from '#features/operations/application/use_cases/transfert.usecase'
import { inject } from '@adonisjs/core'
import { toTransfertDto } from '#features/operations/application/mappers/transfert.mapper'
import WalletToWalletUseCase from '#features/operations/application/use_cases/wallet_to_wallet.use_case'
import { TransferMode } from '#features/operations/application/services/wallet_transfer_context_service'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'

/**
 * Controller responsible for handling user transactions.
 */
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
  async handle({ request, response, auth, deviceInfo }: HttpContext): Promise<void> {
    const user = auth.user!
    const idempotencyKey = request.header('X-Idempotency-Key')
    const payload = await request.validateUsing(transfertValidator)

    const paymentMethod = payload.payment_method_code

    switch (paymentMethod) {
      case PaymentMethod.MOBILE_MONEY:
        const result = await this.transfertUseCase.execute(
          toTransfertDto(payload),
          user,
          deviceInfo,
          idempotencyKey
        )
        return response.ok(result)
      case PaymentMethod.WALLET:
        const data = {
          amount: payload.amount,
          recipient_phone: payload.phone,
          pincode: payload.pincode,
          include_fees: payload.include_fees,
        }
        const walletTOWalletResult = await this.walletTowalletUseCase.execute(
          data,
          user,
          TransferMode.BY_PHONE,
          deviceInfo,
          idempotencyKey
        )
        return response.ok(walletTOWalletResult)

      default:
        return response.badRequest({ message: 'Payment method not supported' })
    }
  }
}
