import { inject } from '@adonisjs/core'
import { UpdateAdminRequestDto, AdminResponseDto } from '#features/team/application/dtos/member.dto'
import hash from '@adonisjs/core/services/hash'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import AdminNotFoundException from '#features/team/infrastructure/exceptions/admin_not_found_exception'
import EmailAlreadyExistsException from '#features/team/infrastructure/exceptions/email_already_exists_exception'
import emitter from '@adonisjs/core/services/emitter'
import Admin from '#features/team/domain/models/admin'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class UpdateAdminUseCase {
  /**
   * Constructor for initializing the class with an AdminRepository.
   *
   * @param {AdminRepository} adminRepository - The repository instance used for managing admin-related data operations.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Updates an existing admin's details based on the provided ID and data.
   *
   * @param {number} id - The unique identifier of the admin to be updated.
   * @param {UpdateAdminRequestDto} data - The data object containing the fields to update for the admin.
   * @param {Admin} auth - The authenticated admin user performing the operation.
   * @return {Promise<AdminResponseDto>} A promise that resolves to the updated admin's details.
   * @throws {AdminNotFoundException} Throws an error if no admin is found with the given ID.
   * @throws {EmailAlreadyExistsException} Throws an error if the new email is already used by another admin.
   */
  async execute(id: number, data: UpdateAdminRequestDto, auth: Admin): Promise<AdminResponseDto> {
    const admin = await this.adminRepository.findById(id)

    if (!admin) throw new AdminNotFoundException()

    if (data.email && data.email !== admin.email) {
      const existingAdmin = await this.adminRepository.findByEmail(data.email)

      if (existingAdmin) throw new EmailAlreadyExistsException()
      admin.email = data.email
    }

    if (data.firstname) admin.firstname = data.firstname
    if (data.lastname) admin.lastname = data.lastname
    if (data.roleId) admin.roleId = data.roleId
    if (data.isActive !== undefined) admin.isActive = data.isActive
    if (data.password) admin.password = await hash.make(data.password)

    await this.adminRepository.save(admin)

    await emitter.emit('activity:audit', {
      eventCategory: 'TEAM',
      eventAction: 'ADMIN_UPDATED',
      actorId: String(auth.id),
      actorType: 'Admin',
      actorRole: auth.role.name,
      targetType: 'Member',
      targetId: String(admin.id),
      result: AuditResult.SUCCESS,
      newValues: {
        email: admin.email,
        roleId: admin.roleId,
        isActive: admin.isActive,
        firstname: admin.firstname,
        lastname: admin.lastname,
      },
    })

    return {
      id: admin.id,
      firstname: admin.firstname,
      lastname: admin.lastname,
      email: admin.email,
      roleId: admin.roleId,
      isActive: admin.isActive,
    }
  }
}
