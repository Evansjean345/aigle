import { inject } from '@adonisjs/core'
import WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import {
  WalletAdjustmentListItemResponseDTO,
  type ListWalletAdjustmentsRequestDto,
  type PaginatedWalletAdjustmentsResponseDTO,
} from '#core/money/wallet/application/dtos/admin/admin_wallet_adjustment_list.dto'

@inject()
export default class ListWalletAdjustmentsUseCase {
  constructor(private readonly walletAdjustmentRepository: WalletAdjustmentRepository) {}

  async execute(
    input: ListWalletAdjustmentsRequestDto
  ): Promise<PaginatedWalletAdjustmentsResponseDTO> {
    const page = input.page ?? 1
    const perPage = input.perPage ?? 20

    const paginator = await this.walletAdjustmentRepository.list(page, perPage, {
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

    return WalletAdjustmentListItemResponseDTO.fromPaginator(paginator)
  }
}
