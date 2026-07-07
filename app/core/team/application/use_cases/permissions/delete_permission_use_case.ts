import { inject } from '@adonisjs/core'
import PermissionRepository from '#core/team/domain/interfaces/permission_repository'
import PermissionNotFoundException from '#core/team/domain/exceptions/permission_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'
import Admin from '#core/team/domain/models/admin'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class DeletePermissionUseCase {
  /**
   * Creates an instance of the class with the specified PermissionRepository.
   *
   * @param {PermissionRepository} permissionRepository - The repository instance used for managing permission data.
   */
  constructor(private permissionRepository: PermissionRepository) {}

  /**
   * Executes the deletion of a permission based on the provided ID.
   * Retrieves the permission from the repository, and if found, removes it.
   * Throws a PermissionNotFoundException if the permission is not found.
   *
   * @param {number} id - The ID of the permission to be deleted.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {PermissionNotFoundException}
   */
  async execute(id: number, auth: Admin): Promise<void> {
    try {
      const permission = await this.permissionRepository.findById(id)
      if (!permission) throw new PermissionNotFoundException()
      await this.permissionRepository.delete(permission)

      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_DELETED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        targetId: String(id),
        result: AuditResult.SUCCESS,
      })
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'PERMISSION_DELETE_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Permission',
        targetId: String(id),
        result: AuditResult.FAILURE,
        errorCode: error.code || 'PERMISSION_DELETE_ERROR',
        errorMessage: error.message || 'La suppression de la permission a échoué',
      })
      throw error
    }
  }
}
