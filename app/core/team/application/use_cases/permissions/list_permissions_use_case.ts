import { inject } from '@adonisjs/core'
import {
  PermissionResponseDto,
  PaginatedPermissionResponseDto,
} from '#core/team/application/dtos/permission.dto'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'

@inject()
export default class ListPermissionsUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance used to manage permission-related data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Retrieves paginated permissions from the repository and maps their data to a specific format.
   *
   * @param {number} page - The page number for pagination (default is 1).
   * @param {number} perPage - The number of items per page (default is 10).
   * @return {Promise<PaginatedPermissionResponseDto>} A promise that resolves to a paginated response with permission data.
   */
  async execute(page: number = 1, perPage: number = 10): Promise<PaginatedPermissionResponseDto> {
    const paginatedPermissions = await this.permissionRepository.paginate(page, perPage)

    const data: PermissionResponseDto[] = paginatedPermissions.all().map((permission) => ({
      id: permission.id,
      slug: permission.slug,
      name: permission.name,
      description: permission.description,
      createdAt: permission.createdAt.toJSDate(),
      updatedAt: permission.updatedAt.toJSDate(),
    }))

    const meta = paginatedPermissions.getMeta()

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
