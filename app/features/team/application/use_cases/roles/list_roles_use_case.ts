import { inject } from '@adonisjs/core'
import { RoleResponseDto, PaginatedRoleResponseDto } from '#features/team/application/dtos/role.dto'
import RoleRepository from '#features/team/domain/interfaces/role_repository'

@inject()
export default class ListRolesUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {RoleRepository} roleRepository - The repository instance used to manage role-related data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Retrieves paginated roles from the repository and maps their data to a specific format.
   *
   * @param {number} page - The page number for pagination (default is 1).
   * @param {number} perPage - The number of items per page (default is 10).
   * @return {Promise<PaginatedRoleResponseDto>} A promise that resolves to a paginated response with role data.
   */
  async execute(page: number = 1, perPage: number = 10): Promise<PaginatedRoleResponseDto> {
    const paginatedRoles = await this.roleRepository.paginate(page, perPage)

    const data: RoleResponseDto[] = paginatedRoles.all().map((role) => ({
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
    }))

    const meta = paginatedRoles.getMeta()

    return {
      data,
      meta: {
        total: meta.total,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
        firstPage: meta.firstPage,
        perPage: meta.perPage,
      },
    }
  }
}
