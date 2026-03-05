import { HttpContext } from '@adonisjs/core/http'
import { transfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import TransfertUseCase from '#features/operations/application/use_cases/transfert.usecase'
import { inject } from '@adonisjs/core'
import { TransfertRequestDto } from '#features/operations/application/dto/transfert.dto'
import WalletToWalletUseCase from '#features/operations/application/use_cases/wallet_to_wallet.use_case'
import { TransferMode } from '#features/operations/application/services/wallet_transfer_context_service'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import User from '#features/user/domain/models/user'
import { WalletToWalletRequestDto } from '#features/operations/application/dto/wallet_to_wallet.dto'

/**
 * Controller responsible for handling user transactions.
 */
@inject()
export default class TransfertController {
  /**
   * Constructor for initializing the class with required use cases.
   *
   * @param {TransfertUseCase} transfertUseCase - An instance of TransfertUseCase to handle transfer operations.
   * @param {WalletToWalletUseCase} walletToWalletUseCase - An instance of WalletToWalletUseCase to handle wallet-to-wallet transactions.
   */
  constructor(
    private readonly transfertUseCase: TransfertUseCase,
    private readonly walletToWalletUseCase: WalletToWalletUseCase
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
  async handle({ request, response, auth, deviceInfo, geoLocation }: HttpContext): Promise<void> {
    console.log('walletToWalletController')
    console.log(deviceInfo)

    const user = auth.user! as User
    const idempotencyKey = request.header('X-Idempotency-Key')
    const payload = await request.validateUsing(transfertValidator)

    const paymentMethod = payload.payment_method_code

    switch (paymentMethod) {
      case PaymentMethod.MOBILE_MONEY:
        const result = await this.transfertUseCase.execute(
          TransfertRequestDto.fromRequest(payload, deviceInfo, geoLocation),
          user,
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

        const walletToWalletResult = await this.walletToWalletUseCase.execute(
          WalletToWalletRequestDto.fromRequest(data, deviceInfo, geoLocation),
          user,
          TransferMode.BY_PHONE,
          idempotencyKey
        )
        return response.ok(walletToWalletResult)

      default:
        return response.badRequest({ message: 'Payment method not supported' })
    }
  }
}
