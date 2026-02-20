import { inject } from '@adonisjs/core'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { UserSearchResponseDto } from '#features/user/application/dtos/admin/user_search.response.dto'
import { mapUserToSearchDto } from '#features/user/application/mappers/admin/users.mapper'

@inject()
export default class SearchUserUseCase {
  /**
   * Creates an instance of the class with the specified user repository.
   *
   * @param {UserRepository} userRepository - The repository used for accessing user data.
   */
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Executes the search logic to find users based on a search term.
   * Returns only the first 6 results.
   *
   * @param {string} search - The search term (phone, account number, name, etc.).
   * @return {Promise<UserSearchResponseDto[]>}
   */
  async execute(search: string): Promise<UserSearchResponseDto[]> {
    const paginatedUsers = await this.userRepository.paginate(
      1,
      6,
      ['kycDocument', 'country', 'keyLevel'],
      search
    )

    return paginatedUsers.all().map((user) => mapUserToSearchDto(user))
  }
}
