import { inject } from '@adonisjs/core'
import {
  UpdatePermissionRequestDto,
  PermissionResponseDto,
} from '#core/team/application/dtos/permission.dto'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'
import PermissionNotFoundException from '#core/team/infrastructure/exceptions/permission_not_found_exception'
import PermissionSlugAlreadyExistsException from '#core/team/infrastructure/exceptions/permission_slug_already_exists_exception'
import Admin from '#core/team/domain/models/admin'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

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
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<PermissionResponseDto>} A promise that resolves with the updated permission's details.
   * @throws {PermissionNotFoundException}
   * @throws {PermissionSlugAlreadyExistsException}
   */
  async execute(
    id: number,
    data: UpdatePermissionRequestDto,
    auth: Admin
  ): Promise<PermissionResponseDto> {
    try {
      const permission = await this.permissionRepository.findById(id)
      if (!permission) throw new PermissionNotFoundException()

      if (data.name !== undefined) {
        permission.name = data.name
      }
      if (data.description !== undefined) permission.description = data.description

      await this.permissionRepository.save(permission)

      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_UPDATED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        targetId: String(permission.id),
        result: AuditResult.SUCCESS,
        newValues: { name: permission.name, description: permission.description },
      })

      return {
        id: permission.id,
        slug: permission.slug,
        name: permission.name,
        description: permission.description,
        createdAt: permission.createdAt.toJSDate(),
        updatedAt: permission.updatedAt.toJSDate(),
      }
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_UPDATE_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        targetId: String(id),
        result: AuditResult.FAILURE,
        metadata: { ...data },
        errorCode: error.code || 'PERMISSION_UPDATE_ERROR',
        errorMessage: error.message || 'La mise à jour de la permission a échoué',
      })
      throw error
    }
  }
}
