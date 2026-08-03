import { inject } from '@adonisjs/core'
import WalletAdjustmentService from '#core/money/wallet/application/services/wallet_adjustment_service'
import {
  type ExecuteWalletAdjustmentRequestDto,
  WalletAdjustmentResponseDTO,
} from '#aiglesend/wallet/application/dtos/admin/admin_wallet_adjustment.dto'

/**
 * Exécute un ajustement de portefeuille depuis le back-office.
 */
@inject()
export default class ExecuteWalletAdjustmentUseCase {
  constructor(private readonly walletAdjustmentService: WalletAdjustmentService) {}

  /**
   * Exécute l'ajustement.
   *
   * @param {ExecuteWalletAdjustmentRequestDto} input - Portefeuille, sens, montant, motif et auteur.
   * @returns {Promise<WalletAdjustmentResponseDTO>} L'ajustement exécuté.
   * @throws {TransactionNotFoundException} Référence de transaction inconnue.
   * @throws {AdjustmentFailedException} Le mouvement de solde a échoué.
   */
  async execute(input: ExecuteWalletAdjustmentRequestDto): Promise<WalletAdjustmentResponseDTO> {
    const adjustment = await this.walletAdjustmentService.adjust({
      walletId: input.walletId,
      type: input.type,
      reason: input.reason,
      amount: input.amount,
      comment: input.comment,
      adminId: input.adminId,
      transactionReference: input.transactionReference,
    })

    return WalletAdjustmentResponseDTO.fromResult(adjustment)
  }
}
