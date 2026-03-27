import { inject } from '@adonisjs/core'
import Admin from '#features/team/domain/models/admin'
import { CreateAdminRequestDto, AdminResponseDto } from '#features/team/application/dtos/member.dto'
import AdminRepository from '#features/team/domain/interfaces/admin_repository'
import EmailAlreadyExistsException from '#features/team/infrastructure/exceptions/email_already_exists_exception'
import { v4 as uuidv4 } from 'uuid'
import { mailFromEmail } from '#config/mail'
import { adminDashboardUrl } from '#config/app'
import { DateTime } from 'luxon'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class CreateAdminUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {AdminRepository} adminRepository - The repository instance to manage admin data.
   */
  constructor(private adminRepository: AdminRepository) {}

  /**
   * Executes the creation of a new admin account, generates an invitation token, and sends an invitation email.
   *
   * @param {CreateAdminRequestDto} data - Data required to create a new admin, including email, firstname, lastname, and optional role ID.
   * @param {Admin} [auth] - The authenticated admin initiating the operation. If not provided, the system is assumed to perform the operation.
   * @return {Promise<AdminResponseDto>} A promise that resolves to an object representing the created admin, including details like ID, name, email, role, and active status.
   * @throws {EmailAlreadyExistsException} Thrown if an admin with the provided email already exists.
   */
  async execute(data: CreateAdminRequestDto, auth?: Admin): Promise<AdminResponseDto> {
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

    await emitter.emit('activity:audit', {
      eventCategory: 'TEAM',
      eventAction: 'ADMIN_CREATED',
      actorType: auth ? 'Admin' : 'System',
      actorId: auth ? auth.id : null,
      actorRole: auth ? auth?.role.name : null,
      initiatedByType: auth ? 'Admin' : 'System',
      initiatedById: auth ? auth.id : null,
      targetType: 'Member',
      targetId: String(admin.id),
      result: AuditResult.SUCCESS,
      newValues: { email: admin.email, roleId: admin.roleId },
    })

    const setupPasswordUrl = `${adminDashboardUrl}/setup-password?token=${admin.invitationToken}`
    await admin.load('role', (roleQuery) => roleQuery.preload('permissions'))

    await SendMailJob.dispatch({
      to: admin.email,
      from: mailFromEmail || 'no-reply@aiglesend.com',
      subject: "Invitation à rejoindre l'administration AigleSend",
      htmlView: 'emails/admin_invitation',
      viewData: {
        admin: admin,
        url: setupPasswordUrl,
      },
    }).toQueue('mail')

    await emitter.emit('activity:audit', {
      eventCategory: 'TEAM',
      eventAction: 'ADMIN_PASSWORD_SETUP_INVITATION_LINK_SENT',
      actorType: 'System',
      actorId: 'team-manager-service',
      initiatedByType: 'Admin',
      initiatedById: admin.id,
      targetType: 'Member',
      targetId: String(admin.id),
      metadata: { via: 'email', template: 'emails/admin_invitation', email: admin.email },
    })

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
