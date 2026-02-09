import { inject } from '@adonisjs/core'
import Permission from '#features/team/domain/models/permission'
import {
  CreatePermissionRequestDto,
  PermissionResponseDto,
} from '#features/team/application/dtos/permission.dto'
import PermissionRepository from '#features/team/domain/interfaces/permission_repository'
import PermissionSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/permission_slug_already_exists_exception'

@inject()
export default class CreatePermissionUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance to manage permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Executes the creation of a new permission based on the provided data.
   *
   * @param {CreatePermissionRequestDto} data - The data required to create a new permission.
   * @return {Promise<PermissionResponseDto>} A promise that resolves with the newly created permission's details.
   * @throws {PermissionSlugAlreadyExistsException}
   */
  async execute(data: CreatePermissionRequestDto): Promise<PermissionResponseDto> {
    const existingPermission = await this.permissionRepository.findBySlug(data.slug)
    if (existingPermission) throw new PermissionSlugAlreadyExistsException()

    const permission = new Permission()
    permission.slug = data.slug
    permission.name = data.name
    permission.description = data.description ?? null

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
