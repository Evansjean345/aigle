import { inject } from '@adonisjs/core'
import RefundRepository from '#core/transactions/domain/interfaces/refund_repository'
import {
  RefundListItemResponseDTO,
  type ListRefundsRequestDto,
  type PaginatedRefundsResponseDTO,
} from '#core/transactions/application/dtos/admin/admin_refund_list.dto'

@inject()
export default class GetRefundsUseCase {
  /**
   * Constructs a new instance.
   * @param {RefundRepository} refundRepository The repository for managing refunds.
   */
  constructor(private readonly refundRepository: RefundRepository) {}

  /**
   * Executes the refund listing process, applying filter criteria and pagination.
   * Defaults to page 1 and 20 items per page if pagination parameters are not provided.
   *
   * @param {ListRefundsRequestDto} input - The request data transfer object containing pagination and filter parameters for the refunds query.
   * @return {Promise<PaginatedRefundsResponseDTO>} A promise that resolves to a paginated response data transfer object containing the list of refunds.
   */
  async execute(input: ListRefundsRequestDto): Promise<PaginatedRefundsResponseDTO> {
    const page = input.page ?? 1
    const perPage = input.perPage ?? 20

    const paginator = await this.refundRepository.list(page, perPage, {
      walletId: input.walletId,
      userId: input.userId,
      adminId: input.adminId,
      transactionId: input.transactionId,
      type: input.type,
      reason: input.reason,
      search: input.search,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      startDate: input.startDate,
      endDate: input.endDate,
    })

    return RefundListItemResponseDTO.fromPaginator(paginator)
  }
}
