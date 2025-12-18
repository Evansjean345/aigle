import UserRepository from '#features/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'
import { AdminUsersListResponseDto } from '#features/user/application/dtos/admin/users.response.dto'
import { mapUserToAdminListItemDto } from '#features/user/application/mappers/admin/users.mapper'

@inject()
export default class GetAllUsersUseCase {
  /**
   * Creates an instance of the class with the given user repository.
   *
   * @param {UserRepository} userRepository - The user repository used for interacting with user data.
   */
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Executes the main logic of the method asynchronously.
   *
   * @return {Promise<any>} A promise that resolves with the result of the execution.
   */
  async execute(): Promise<AdminUsersListResponseDto> {
    const users = await this.userRepository.all(['wallet', 'keyLevel', 'kycDocument', 'country'])
    return users.map(mapUserToAdminListItemDto)
  }
}
