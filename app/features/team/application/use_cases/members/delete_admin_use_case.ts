import { inject } from '@adonisjs/core'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import AdminNotFoundException from '#features/team/infrastructure/exceptions/admin_not_found_exception'

@inject()
export default class DeleteAdminUseCase {
  /**
   * Creates an instance of the class with the specified AdminRepository.
   *
   * @param {AdminRepository} adminRepository - The repository instance used for managing admin data.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Executes the deletion of an admin based on the provided ID.
   * Retrieves the admin from the repository, and if found, removes it.
   * Throws an AdminNotFoundException if the admin is not found.
   *
   * @param {number} id - The ID of the admin to be deleted.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {AdminNotFoundException}
   */
  async execute(id: number): Promise<void> {
    const admin = await this.adminRepository.findById(id)
    if (!admin) throw new AdminNotFoundException()
    await this.adminRepository.delete(admin)
  }
}
