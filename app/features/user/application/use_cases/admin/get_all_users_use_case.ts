import UserRepository from '#features/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'
import { AdminUsersListResponseDto } from '#features/user/application/dtos/admin/users.response.dto'
import { mapUserToAdminListItemDto } from '#features/user/application/mappers/admin/users.mapper'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'

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
   * @return {Promise<AdminUsersListResponseDto>} A promise that resolves with the result of the execution.
   */
  async execute(page: number = 1, perPage: number = 16): Promise<AdminUsersListResponseDto> {
    const paginatedUsers = await this.userRepository.paginate(page, perPage, [
      'wallet',
      'keyLevel',
      'kycDocument',
      'country',
    ])

    const items = paginatedUsers.all()
    const userIds = items.map((user) => user.usersUid)
    const volumes = await this.transactionVolumeCache.getMonthlyVolumesForUsers(userIds)

    const data = items.map((user) => {
      user['transactionVolumes'] = {
        monthly: volumes[user.usersUid] || 0,
      }

      return mapUserToAdminListItemDto(user)
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
