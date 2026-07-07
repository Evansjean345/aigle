import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'
import {
  AdminUserListItemResponseDto,
  AdminUsersListResponseDto,
} from '#core/identity/user/application/dtos/admin/users.response.dto'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import { DateTime } from 'luxon'

@inject()
export default class GetAllUsersUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param userRepository
   * @param transactionVolumeCache
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionVolumeCache: TransactionVolumeCache
  ) {}

  /**
   * Executes the main logic of the method asynchronously.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of users per page.
   * @param {string} [search] - Optional search term.
   * @param {string} [startDate] - Optional start date filter.
   * @param {string} [endDate] - Optional end date filter.
   * @return {Promise<AdminUsersListResponseDto>} A promise that resolves with the result of the execution.
   */
  async execute(
    page: number = 1,
    perPage: number = 16,
    search?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AdminUsersListResponseDto> {
    const paginatedUsers = await this.userRepository.paginate(
      page,
      perPage,
      ['wallet', 'keyLevel', 'kycDocument', 'country'],
      search,
      startDate,
      endDate
    )

    const items = paginatedUsers.all()
    const userIds = items.map((user) => user.usersUid)

    const dt = startDate ? DateTime.fromISO(startDate) : undefined
    const volumes = await this.transactionVolumeCache.getMonthlyVolumesForUsers(userIds, dt)

    const data = items.map((user) => {
      return AdminUserListItemResponseDto.fromUser(user, {
        monthlyVolume: volumes[user.usersUid] || 0,
      })
    })

    return {
      data: data,
      meta: {
        total: paginatedUsers.total,
        currentPage: paginatedUsers.currentPage,
        firstPage: paginatedUsers.firstPage,
        lastPage: paginatedUsers.lastPage,
        perPage: paginatedUsers.perPage,
      },
    }
  }
}
