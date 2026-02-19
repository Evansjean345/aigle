import { inject } from '@adonisjs/core'
import RoleRepository from '#features/team/domain/interfaces/role_repository'
import RoleNotFoundException from '#features/team/infrastructure/exceptions/role_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'
import Admin from '#features/team/domain/models/admin'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class DeleteRoleUseCase {
  /**
   * Creates an instance of the class with the specified RoleRepository.
   *
   * @param {RoleRepository} roleRepository - The repository instance used for managing role data.
   */
  constructor(private roleRepository: RoleRepository) {}

  /**
   * Executes the deletion of a role based on the provided ID.
   * Retrieves the role from the repository, and if found, removes it.
   * Throws a RoleNotFoundException if the role is not found.
   *
   * @param {number} id - The ID of the role to be deleted.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {RoleNotFoundException}
   */
  async execute(id: number, auth: Admin): Promise<void> {
    try {
      const role = await this.roleRepository.findById(id)
      if (!role) throw new RoleNotFoundException()
      await this.roleRepository.delete(role)

      await emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'ROLE_DELETED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        targetId: String(id),
        result: AuditResult.SUCCESS,
      })
    } catch (error) {
      await emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'ROLE_DELETE_FAILED',
        actorId: String(auth.id),
        actorType: 'Admin',
        actorRole: auth.role.name,
        targetType: 'Role',
        targetId: String(id),
        result: AuditResult.FAILURE,
        errorCode: error.code || 'ROLE_DELETE_ERROR',
        errorMessage: error.message || 'La suppression du rôle a échoué',
      })
      throw error
    }
  }
}
