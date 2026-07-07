import { inject } from '@adonisjs/core'
import { RoleResponseDto } from '#core/team/application/dtos/role.dto'
import RoleRepository from '#core/team/domain/interfaces/role_repository'
import RoleNotFoundException from '#core/team/domain/exceptions/role_not_found_exception'

@inject()
export default class GetRoleUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance to manage role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Retrieves a role by its ID.
   *
   * @param {number} id - The ID of the role to retrieve.
   * @return {Promise<RoleResponseDto>} A promise that resolves with the role's details.
   * @throws {RoleNotFoundException}
   */
  async execute(id: number): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findById(id)
    if (!role) throw new RoleNotFoundException()

    return {
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt.toJSDate(),
        updatedAt: p.updatedAt.toJSDate(),
      })),
      createdAt: role.createdAt.toJSDate(),
      updatedAt: role.updatedAt.toJSDate(),
    }
  }
}
