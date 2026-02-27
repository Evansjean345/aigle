import { inject } from '@adonisjs/core'
import { UpdateRoleRequestDto, RoleResponseDto } from '#features/team/application/dtos/role.dto'
import RoleRepository from '#features/team/domain/interfaces/role_repository'
import RoleNotFoundException from '#features/team/infrastructure/exceptions/role_not_found_exception'
import RoleSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/role_slug_already_exists_exception'
import string from '@adonisjs/core/helpers/string'

@inject()
export default class UpdateRoleUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance to manage role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the update of an existing role based on the provided data.
   *
   * @param {number} id - The ID of the role to update.
   * @param {UpdateRoleRequestDto} data - The data to update the role with.
   * @return {Promise<RoleResponseDto>} A promise that resolves with the updated role's details.
   * @throws {RoleNotFoundException}
   * @throws {RoleSlugAlreadyExistsException}
   */
  async execute(id: number, data: UpdateRoleRequestDto): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findById(id)
    if (!role) throw new RoleNotFoundException()

    if (data.name !== undefined) {
      const newSlug = string.slug(data.name, { lower: true, replacement: '_' })

      if (newSlug !== role.slug) {
        const existingRole = await this.roleRepository.findBySlug(newSlug)
        if (existingRole) throw new RoleSlugAlreadyExistsException()
        role.slug = newSlug
      }

      role.name = data.name
    }
    if (data.description !== undefined) role.description = data.description

    await this.roleRepository.save(role)

    if (data.permissionIds !== undefined) {
      await this.roleRepository.syncPermissions(role, data.permissionIds)
    }

    const updatedRole = await this.roleRepository.findById(role.id)

    return {
      id: updatedRole!.id,
      slug: updatedRole!.slug,
      name: updatedRole!.name,
      description: updatedRole!.description,
      permissions: updatedRole!.permissions.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt.toJSDate(),
        updatedAt: p.updatedAt.toJSDate(),
      })),
      createdAt: updatedRole!.createdAt.toJSDate(),
      updatedAt: updatedRole!.updatedAt.toJSDate(),
    }
  }
}
