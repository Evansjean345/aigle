import { inject } from '@adonisjs/core'
import WalletService from '#features/wallet/application/services/wallet_service'
import { type UpdateWalletStatusCommand } from '#features/wallet/application/dtos/admin/admin_wallet.dto'
import Wallet from '#features/wallet/domain/models/wallet'

@inject()
export default class UpdateWalletStatusUseCase {
  /**
   * Constructs a new instance of the class.
   *
   * @param {WalletService} walletService - The wallet service used for handling wallet-related operations.
   */
  constructor(private walletService: WalletService) {}

  /**
   * Executes the update wallet status operation based on the provided command.
   *
   * @param {UpdateWalletStatusCommand} command - The command containing the user ID and the desired wallet status.
   * @return {Promise<Wallet>} A promise that resolves with the updated wallet information.
   */
  async execute(command: UpdateWalletStatusCommand): Promise<Wallet> {
    return await this.walletService.updateWalletStatus(command.userId, command.status)
  }
}
