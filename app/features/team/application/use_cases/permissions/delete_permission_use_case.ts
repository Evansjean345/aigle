import { inject } from '@adonisjs/core'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'
import PermissionNotFoundException from '#features/team/infrastructure/exceptions/permission_not_found_exception'

@inject()
export default class DeletePermissionUseCase {
  /**
   * Creates an instance of the class with the specified PermissionRepository.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance used for managing permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Executes the deletion of a permission based on the provided ID.
   * Retrieves the permission from the repository, and if found, removes it.
   * Throws a PermissionNotFoundException if the permission is not found.
   *
   * @param {number} id - The ID of the permission to be deleted.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {PermissionNotFoundException}
   */
  async execute(id: number): Promise<void> {
    const permission = await this.permissionRepository.findById(id)
    if (!permission) throw new PermissionNotFoundException()
    await this.permissionRepository.delete(permission)
  }
}
