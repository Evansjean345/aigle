import { inject } from '@adonisjs/core'
import { SimplePermissionResponseDto } from '#features/team/application/dtos/permission.dto'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'

@inject()
export default class ListAllPermissionsUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance used to manage permission-related data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Retrieves all permissions from the repository and maps their data to a specific format.
   *
   * @return {Promise<SimplePermissionResponseDto[]>} A promise that resolves to an array of permission data.
   */
  async execute(): Promise<SimplePermissionResponseDto[]> {
    const permissions = await this.permissionRepository.all()

    return permissions.map((permission) => ({
      id: permission.id,
      slug: permission.slug,
      name: permission.name,
      description: permission.description,
    }))
  }
}
