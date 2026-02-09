import { inject } from '@adonisjs/core'
import RoleRepository from '#features/team/domain/interfaces/role_repository'
import RoleNotFoundException from '#features/team/infrastructure/exceptions/role_not_found_exception'

@inject()
export default class DeleteRoleUseCase {
  /**
   * Creates an instance of the class with the specified RoleRepository.
   *
   * @param {RoleRepository} roleRepository - The repository instance used for managing role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the deletion of a role based on the provided ID.
   * Retrieves the role from the repository, and if found, removes it.
   * Throws a RoleNotFoundException if the role is not found.
   *
   * @param {number} id - The ID of the role to be deleted.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {RoleNotFoundException}
   */
  async execute(id: number): Promise<void> {
    const role = await this.roleRepository.findById(id)
    if (!role) throw new RoleNotFoundException()
    await this.roleRepository.delete(role)
  }
}
