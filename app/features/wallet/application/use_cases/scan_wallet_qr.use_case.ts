import WalletService from '#features/wallet/application/services/wallet_service'
import { WalletQrScanResult } from '#features/wallet/application/dtos/wallet_qr_scan.result'
import { inject } from '@adonisjs/core'

/**
 * A use case class responsible for handling the scanning of a wallet QR code
 * and retrieving the corresponding user account information.
 */
@inject()
export default class ScanWalletQrUseCase {
  /**
   * Constructs an instance of the class with the given WalletService.
   *
   * @param {WalletService} walletService - The wallet service to be used by this class.
   */
  constructor(private readonly walletService: WalletService) {}

  /**
   * Executes the provided QR code string and retrieves the wallet account information.
   *
   * @param {string} qrcode - The QR code string representing the wallet token.
   * @return {Promise<WalletQrScanResult>} A promise that resolves to the result of scanning the wallet's QR code.
   */
  async execute(qrcode: string): Promise<WalletQrScanResult> {
    return await this.walletService.getUserAccountByWalletToken(qrcode)
  }
}
