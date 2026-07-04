import { HttpContext } from '@adonisjs/core/http'
import { transfertValidator } from '#aiglesend/operations/presentation/mobile/validators/transfert_validator'
import TransfertUseCase from '#aiglesend/operations/application/use_cases/transfert.usecase'
import { inject } from '@adonisjs/core'
import { TransfertRequestDto } from '#aiglesend/operations/application/dtos/transfert.dto'
import WalletToWalletUseCase from '#aiglesend/operations/application/use_cases/wallet_to_wallet.use_case'
import { TransferMode } from '#aiglesend/operations/application/services/recipient_locator'
import { PaymentMethod } from '#core/transactions/domain/enums/payment_method'
import User from '#core/user/domain/models/user'
import { WalletToWalletRequestDto } from '#aiglesend/operations/application/dtos/wallet_to_wallet.dto'

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
    console.log('debugging payload')
    console.log(request.all())

    const user = auth.user! as User
    const idempotencyKey = request.header('X-Idempotency-Key')
    const payload = await request.validateUsing(transfertValidator)

    const paymentMethod = payload.payment_method_code
    const context = {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    }

    switch (paymentMethod) {
      case PaymentMethod.MOBILE_MONEY:
        const result = await this.transfertUseCase.execute(
          TransfertRequestDto.fromRequest(payload, deviceInfo, geoLocation, context),
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
          WalletToWalletRequestDto.fromRequest(data, deviceInfo, geoLocation, context),
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
