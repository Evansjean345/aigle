import { inject } from '@adonisjs/core'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { type UpdateWalletStatusCommand } from '#aiglesend/wallet/application/dtos/admin/admin_wallet.dto'
import { type WalletStatusResult } from '#core/money/wallet/application/dtos/wallet.dto'

/**
 * Gèle ou dégèle le portefeuille d'un utilisateur depuis le back-office.
 */
@inject()
export default class UpdateWalletStatusUseCase {
  constructor(private walletService: WalletService) {}

  /**
   * Applique le statut demandé.
   *
   * @param {UpdateWalletStatusCommand} command - Utilisateur visé et statut à appliquer.
   * @returns {Promise<WalletStatusResult>} Le portefeuille dans son nouvel état.
   * @throws {Exception} Aucun portefeuille pour cet utilisateur, ou mise à jour refusée.
   */
  async execute(command: UpdateWalletStatusCommand): Promise<WalletStatusResult> {
    return this.walletService.updateWalletStatus(command.userId, command.status)
  }
}
