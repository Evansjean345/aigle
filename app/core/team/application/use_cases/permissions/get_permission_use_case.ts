import { inject } from '@adonisjs/core'
import { PermissionResponseDto } from '#core/team/application/dtos/permission.dto'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'
import PermissionNotFoundException from '#core/team/domain/exceptions/permission_not_found_exception'

@inject()
export default class GetPermissionUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance to manage permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Retrieves a permission by its ID.
   *
   * @param {number} id - The ID of the permission to retrieve.
   * @return {Promise<PermissionResponseDto>} A promise that resolves with the permission's details.
   * @throws {PermissionNotFoundException}
   */
  async execute(id: number): Promise<PermissionResponseDto> {
    const permission = await this.permissionRepository.findById(id)
    if (!permission) throw new PermissionNotFoundException()

    return {
      id: permission.id,
      slug: permission.slug,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt.toJSDate(),
      updatedAt: permission.updatedAt.toJSDate(),
    }
  }
}
