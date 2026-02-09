import { inject } from '@adonisjs/core'
import Admin from '#features/team/domain/models/admin'
import { CreateAdminRequestDto, AdminResponseDto } from '#features/team/application/dtos/member.dto'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import EmailAlreadyExistsException from '#features/team/infrastructure/exceptions/email_already_exists_exception'

@inject()
export default class CreateAdminUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository instance to manage admin data.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Executes the creation of a new admin user based on the provided data.
   *
   * @param {CreateAdminRequestDto} data - The data required to create a new admin, including firstname, lastname, email, password, and role.
   * @return {Promise<AdminResponseDto>} A promise that resolves with the newly created admin's details, including id, firstname, lastname, email, role, and isActive status.
   * @throws {EmailAlreadyExistsException}
   */
  async execute(data: CreateAdminRequestDto): Promise<AdminResponseDto> {
    const existingAdmin = await this.adminRepository.findByEmail(data.email)
    if (existingAdmin) throw new EmailAlreadyExistsException()

    const admin = new Admin()
    admin.firstname = data.firstname
    admin.lastname = data.lastname
    admin.email = data.email
    admin.roleId = data.roleId ?? 2 // Par défaut 'admin' si on définit ID 2 pour admin
    admin.isActive = true

    await this.adminRepository.save(admin)

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
