import { inject } from '@adonisjs/core'
import {
  UpdatePermissionRequestDto,
  PermissionResponseDto,
} from '#features/team/application/dtos/permission.dto'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'
import PermissionNotFoundException from '#features/team/infrastructure/exceptions/permission_not_found_exception'
import PermissionSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/permission_slug_already_exists_exception'

@inject()
export default class UpdatePermissionUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance to manage permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Executes the update of an existing permission based on the provided data.
   *
   * @param {number} id - The ID of the permission to update.
   * @param {UpdatePermissionRequestDto} data - The data to update the permission with.
   * @return {Promise<PermissionResponseDto>} A promise that resolves with the updated permission's details.
   * @throws {PermissionNotFoundException}
   * @throws {PermissionSlugAlreadyExistsException}
   */
  async execute(id: number, data: UpdatePermissionRequestDto): Promise<PermissionResponseDto> {
    const permission = await this.permissionRepository.findById(id)
    if (!permission) throw new PermissionNotFoundException()

    if (data.name !== undefined) {
      permission.name = data.name
    }
    if (data.description !== undefined) permission.description = data.description

    await this.permissionRepository.save(permission)

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
