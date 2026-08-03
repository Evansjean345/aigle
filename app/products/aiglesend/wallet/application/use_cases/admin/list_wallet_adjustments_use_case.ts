import { inject } from '@adonisjs/core'
import WalletAdjustmentService from '#core/money/wallet/application/services/wallet_adjustment_service'
import {
  WalletAdjustmentListItemResponseDTO,
  type ListWalletAdjustmentsRequestDto,
  type PaginatedWalletAdjustmentsResponseDTO,
} from '#aiglesend/wallet/application/dtos/admin/admin_wallet_adjustment_list.dto'

/**
 * Liste les ajustements de portefeuille pour l'espace admin.
 */
@inject()
export default class ListWalletAdjustmentsUseCase {
  constructor(private readonly walletAdjustmentService: WalletAdjustmentService) {}

  /**
   * Exécute la lecture.
   *
   * @param {ListWalletAdjustmentsRequestDto} input - Filtres et pagination.
   * @returns {Promise<PaginatedWalletAdjustmentsResponseDTO>} La page demandée.
   */
  async execute(
    input: ListWalletAdjustmentsRequestDto
  ): Promise<PaginatedWalletAdjustmentsResponseDTO> {
    const page = await this.walletAdjustmentService.list(input.page ?? 1, input.perPage ?? 20, {
      walletId: input.walletId,
      userId: input.userId,
      adminId: input.adminId,
      type: input.type,
      reason: input.reason,
      search: input.search,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    return WalletAdjustmentListItemResponseDTO.fromResultPage(page)
  }
}
