import { inject } from '@adonisjs/core'
import Admin from '#features/team/domain/models/admin'
import { CreateAdminRequestDto, AdminResponseDto } from '#features/team/application/dtos/member.dto'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import EmailAlreadyExistsException from '#features/team/infrastructure/exceptions/email_already_exists_exception'
import { v4 as uuidv4 } from 'uuid'
import { mailFromEmail } from '#config/mail'
import { adminDashboardUrl } from '#config/app'
import { DateTime } from 'luxon'
import queue from '@rlanz/bull-queue/services/main'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'

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
    admin.roleId = data.roleId ?? 2
    admin.isActive = false
    admin.invitationToken = uuidv4()
    admin.invitationExpiresAt = DateTime.now().plus({ minutes: 5 })

    await this.adminRepository.save(admin)
    const setupPasswordUrl = `${adminDashboardUrl}/setup-password?token=${admin.invitationToken}`

    await admin.load('role', (roleQuery) => roleQuery.preload('permissions'))

    await queue.dispatch(
      SendMailJob,
      {
        to: admin.email,
        from: mailFromEmail || 'no-reply@aiglesend.com',
        subject: "Invitation à rejoindre l'administration AigleSend",
        htmlView: 'emails/admin_invitation',
        viewData: {
          admin: admin,
          url: setupPasswordUrl,
        },
      },
      { queueName: 'mail' }
    )

    return {
      id: admin.id,
      firstname: admin.firstname,
      lastname: admin.lastname,
      email: admin.email,
      role: {
        id: admin.roleId,
        slug: admin.role.slug,
        name: admin.role.name,
        permissions: admin.role.permissions.map((p) => p.slug),
      },
      isActive: admin.isActive,
    }
  }
}
