import { HttpContext } from '@adonisjs/core/http'
import { walletScanValidator } from '#mobile/wallet/validators/wallet_scan_validator'
import ScanWalletQrUseCase from '#mobile/wallet/use_cases/scan_wallet_qr.use_case'
import { inject } from '@adonisjs/core'

/**
 * Controller that handles the wallet QR code scanning functionality.
 */
@inject()
export default class WalletScanController {
  /**
   * Constructor for the class that initializes with the provided ScanWalletQrUseCase instance.
   *
   * @param {ScanWalletQrUseCase} scanWalletQrUseCase - The use case instance responsible for handling wallet QR scanning functionality.
   */
  constructor(private readonly scanWalletQrUseCase: ScanWalletQrUseCase) {}

  /**
   * Handles the incoming HTTP request for scanning a wallet QR code, validates the request data,
   * and executes the use case to process the QR code.
   *
   * @param {object} HttpContext - The HTTP context object.
   * @param {object} HttpContext.request - The HTTP request object containing payload and other properties.
   * @param {object} HttpContext.response - The HTTP response object used to send back the response.
   *
   * @return {Promise<void>} A promise that resolves with no value after successfully processing the request.
   */
  async handle({ request, response }: HttpContext): Promise<void> {
    try {
      const payload = await request.validateUsing(walletScanValidator)
      const result = await this.scanWalletQrUseCase.execute(payload.qrcode)
      return response.ok(result)
    } catch (error: any) {
      throw error
    }
  }
}
