import UserRepository from '#features/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'

@inject()
export default class GetUserStatsUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param userRepository
   */
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Executes the main logic of the method asynchronously to retrieve user statistics.
   *
   * @param {string} [startDate] - Optional start date filter.
   * @param {string} [endDate] - Optional end date filter.
   * @return {Promise<Record<string, number>>} A promise that resolves to a record of user statistics.
   */
  async execute(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    return await this.userRepository.getStats(startDate, endDate)
  }
}
