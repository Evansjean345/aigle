import { inject } from '@adonisjs/core'
import {
  AdminResponseDto,
  PaginatedAdminResponseDto,
} from '#features/team/application/dtos/member.dto'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'

@inject()
export default class ListTeamMembersUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository instance used to manage admin-related data.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Retrieves paginated administrators from the repository and maps their data to a specific format.
   *
   * @param {number} page - The page number for pagination (default is 1).
   * @param {number} perPage - The number of items per page (default is 10).
   * @return {Promise<PaginatedAdminResponseDto>} A promise that resolves to a paginated response with administrator data.
   */
  async execute(page: number = 1, perPage: number = 10): Promise<PaginatedAdminResponseDto> {
    const paginatedAdmins = await this.adminRepository.paginate(page, perPage)

    const data: AdminResponseDto[] = paginatedAdmins.all().map((admin) => ({
      id: admin.id,
      firstname: admin.firstname,
      lastname: admin.lastname,
      email: admin.email,
      createdAt: admin.createdAt,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
      role: {
        id: admin.role.id,
        slug: admin.role.slug,
        name: admin.role.name,
        permissions: admin.role.permissions.map((p) => p.slug),
      },
      isActive: admin.isActive,
    }))

    const meta = paginatedAdmins.getMeta()

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
