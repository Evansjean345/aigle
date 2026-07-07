import { inject } from '@adonisjs/core'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import AdminNotFoundException from '#core/team/domain/exceptions/admin_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'
import Admin from '#core/team/domain/models/admin'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class DeleteAdminUseCase {
  /**
   * Creates an instance of the class with the specified AdminRepository.
   *
   * @param {AdminRepository} adminRepository - The repository instance used for managing admin data.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Executes the deletion of an admin based on the provided ID.
   * Retrieves the admin from the repository, and if found, removes it.
   * Throws an AdminNotFoundException if the admin is not found.
   *
   * @param {number} id - The ID of the admin to be deleted.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {AdminNotFoundException}
   */
  async execute(id: number, auth: Admin): Promise<void> {
    const admin = await this.adminRepository.findById(id)
    if (!admin) throw new AdminNotFoundException()
    await this.adminRepository.delete(admin)

    emitter.emit('activity:audit', {
      eventCategory: 'TEAM',
      eventAction: 'ADMIN_DELETED',
      actorId: String(auth.id),
      actorType: 'Admin',
      actorRole: auth.role.name,
      targetType: 'Member',
      targetId: String(id),
      result: AuditResult.SUCCESS,
    })
  }
}
