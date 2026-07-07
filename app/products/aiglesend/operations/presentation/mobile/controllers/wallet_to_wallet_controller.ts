import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import WalletToWalletUseCase from '#aiglesend/operations/application/use_cases/wallet_to_wallet.use_case'
import { walletToWalletValidator } from '#aiglesend/operations/presentation/mobile/validators/wallet_to_wallet_validator'
import { TransferMode } from '#aiglesend/operations/application/services/recipient_locator'
import { WalletToWalletRequestDto } from '#aiglesend/operations/application/dtos/wallet_to_wallet.dto'

/**
 * Controller responsible for handling wallet-to-wallet operations.
 */
@inject()
export default class WalletToWalletController {
  /**
   * Initializes a new instance of the class with the specified WalletToWalletUseCase.
   * @param {WalletToWalletUseCase} walletToWalletUseCase - An instance of the WalletToWalletUseCase to handle wallet-to-wallet operations.
   */
  constructor(private readonly walletToWalletUseCase: WalletToWalletUseCase) {}

  /**
   * Handles an HTTP request, validates the payload, executes the use case with the provided user, and returns an appropriate response.
   *
   * @param {object} HttpContext - The HTTP context object containing request, response, and auth instances.
   * @param {Request} HttpContext.request - The HTTP request object for processing payload and input.
   * @param {Response} HttpContext.response - The HTTP response object for sending back responses.
   */
  async handle({
    request,
    response,
    authActor,
    deviceInfo,
    geoLocation,
  }: HttpContext): Promise<void> {
    console.log('walletToWalletController')
    console.log(deviceInfo)

    const payload = await request.validateUsing(walletToWalletValidator)

    const user = authActor!
    const idempotencyKey = request.header('X-Idempotency-Key')
    const mode = payload.token ? TransferMode.BY_QRCODE : TransferMode.BY_PHONE

    const dto = WalletToWalletRequestDto.fromRequest(payload, deviceInfo, geoLocation, {
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
    })

    const result = await this.walletToWalletUseCase.execute(dto, user, mode, idempotencyKey)
    return response.ok(result)
  }
}
