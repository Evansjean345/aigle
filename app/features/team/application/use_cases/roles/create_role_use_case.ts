import { inject } from '@adonisjs/core'
import Role from '#features/team/domain/models/role'
import { CreateRoleRequestDto, RoleResponseDto } from '#features/team/application/dtos/role.dto'
import RoleRepository from '#features/team/domain/interfaces/role_repository'
import RoleSlugAlreadyExistsException from '#features/team/infrastructure/exceptions/role_slug_already_exists_exception'
import string from '@adonisjs/core/helpers/string'

@inject()
export default class CreateRoleUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance to manage role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the creation of a new role based on the provided data.
   *
   * @param {CreateRoleRequestDto} data - The data required to create a new role.
   * @return {Promise<RoleResponseDto>} A promise that resolves with the newly created role's details.
   * @throws {RoleSlugAlreadyExistsException}
   */
  async execute(data: CreateRoleRequestDto): Promise<RoleResponseDto> {
    const slug = string.slug(data.name, { lower: true, replacement: '_' })

    const existingRole = await this.roleRepository.findBySlug(slug)
    if (existingRole) throw new RoleSlugAlreadyExistsException()

    const role = new Role()
    role.slug = slug
    role.name = data.name
    role.description = data.description ?? null

    await this.roleRepository.save(role)

    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.roleRepository.syncPermissions(role, data.permissionIds)
    }

    const savedRole = await this.roleRepository.findById(role.id)

    return {
      id: savedRole!.id,
      slug: savedRole!.slug,
      name: savedRole!.name,
      description: savedRole!.description,
      permissions: savedRole!.permissions.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt.toJSDate(),
        updatedAt: p.updatedAt.toJSDate(),
      })),
      createdAt: savedRole!.createdAt.toJSDate(),
      updatedAt: savedRole!.updatedAt.toJSDate(),
    }
  }
}
