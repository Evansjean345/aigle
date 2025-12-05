import UserRepository from '#features/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'
import { UserKycStatus } from '#features/user/domain/enum'
import { Exception } from '@adonisjs/core/exceptions'
import { Logger } from '@adonisjs/core/logger'

@inject()
export default class UpdateUserKycStatus {
  /**
   * Constructs an instance of the class with a dependency on UserRepository.
   *
   * @param {UserRepository} userRepository - The repository used to manage user data.
   * @param logger
   */
  constructor(
    private userRepository: UserRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Executes the process of retrieving a user by ID and performing an action based on their KYC status.
   * Throws an exception if the user is not found.
   *
   * @param {string} userId - The unique identifier of the user to be retrieved.
   * @param {UserKycStatus} status - The KYC (Know Your Customer) status associated with the user.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   * @throws {Exception} If the user does not exist, it throws an Exception with status 404 and code 'USER_NOT_FOUND'.
   */
  async execute(userId: string, status: UserKycStatus): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      this.logger.warn(
        {
          userId: userId,
          status: status,
        },
        `user with id ${userId} does not exist`
      )

      throw new Exception('User does not exist', {
        status: 404,
        code: 'USER_NOT_FOUND',
      })
    }

    try {
      user.kycStatus = status
      await this.userRepository.save(user)
    } catch (error) {
      this.logger.error(
        {
          message: error.message,
          status: status,
          stack: error.stack,
        },
        "error while updating user's kyc status"
      )
      throw error
    }
  }
}
