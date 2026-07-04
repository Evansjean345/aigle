import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Admin from '#core/team/domain/models/admin'
import Role from '#core/team/domain/models/role'
import AdminRepository from '#core/team/domain/interfaces/admin_repository'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

export default class CreateSuperAdmin extends BaseCommand {
  static commandName = 'make:super-admin'
  static description = 'Create the first super admin account'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Creates the bootstrap super admin account.
   *
   * Unlike the regular admin-invitation flow, this command does NOT send an
   * invitation link: the operator types the password directly at the prompt and
   * the account is created already active (no invitation token, no setup email).
   * The password is validated against the project's strong-password policy and
   * confirmed, then hashed automatically by the model's auth-finder hook on save.
   *
   * @return {Promise<void>} Resolves when the process completes successfully or fails with an error.
   */
  async run(): Promise<void> {
    const firstname = await this.prompt.ask('Enter firstname', {
      validate: (value) => (value?.trim() ? true : 'Firstname is required'),
    })
    const lastname = await this.prompt.ask('Enter lastname', {
      validate: (value) => (value?.trim() ? true : 'Lastname is required'),
    })
    const email = await this.prompt.ask('Enter email', {
      validate: (value) => (value?.trim() ? true : 'Email is required'),
    })

    const superAdminRole = await Role.findBy('slug', 'root')

    if (!superAdminRole) {
      this.logger.error('Failed to create super admin; Super admin role not found')
      return
    }

    const adminRepository = await this.app.container.make(AdminRepository)

    const existingAdmin = await adminRepository.findByEmail(email.trim())

    if (existingAdmin) {
      this.logger.error(
        `Failed to create super admin; an admin already exists with ${email.trim()}`
      )
      return
    }

    const password = await this.prompt.secure('Enter password', {
      validate(value) {
        if (!value || value.length < 8) return 'Password must be at least 8 characters'
        if (value.length > 128) return 'Password must be at most 128 characters'
        if (!STRONG_PASSWORD_REGEX.test(value)) {
          return 'Password must include a lowercase, an uppercase, a digit and a special character'
        }
        return true
      },
    })

    await this.prompt.secure('Confirm password', {
      validate: (value) => (value === password ? true : 'Passwords do not match'),
    })

    try {
      const admin = new Admin()
      admin.firstname = firstname.trim()
      admin.lastname = lastname.trim()
      admin.email = email.trim()
      admin.roleId = superAdminRole.id
      admin.isActive = true
      admin.password = password
      admin.invitationToken = null
      admin.invitationExpiresAt = null

      await adminRepository.save(admin)

      // Awaited (unlike the HTTP flow's fire-and-forget): an Ace command exits
      // as soon as run() returns, tearing down the DB pool. Without awaiting,
      // the async audit INSERT is aborted mid-query and only the ledger_log
      // fallback survives.
      await emitter.emit('activity:audit', {
        eventCategory: 'TEAM',
        eventAction: 'ADMIN_CREATED',
        actorType: 'System',
        actorId: null,
        actorRole: null,
        initiatedByType: 'System',
        initiatedById: null,
        targetType: 'Member',
        targetId: String(admin.id),
        result: AuditResult.SUCCESS,
        newValues: { email: admin.email, roleId: admin.roleId },
        metadata: { via: 'cli:make:super-admin' },
      })

      this.logger.success(`Super admin created: ${admin.email}`)
    } catch (error) {
      this.logger.error('Failed to create super admin')
      this.logger.error(error.message)
    }
  }
}
