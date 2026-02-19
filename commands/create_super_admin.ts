import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import CreateAdminUseCase from '#features/team/application/use_cases/members/create_admin_use_case'
import Role from '#features/team/domain/models/role'

export default class CreateSuperAdmin extends BaseCommand {
  static commandName = 'make:super-admin'
  static description = 'Create the first super admin account'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Executes the process for creating a super admin account.
   * Prompts the user to input necessary account details such as firstname, lastname, email, and password.
   * The method then uses the CreateAdminUseCase to create the super admin with the specified details.
   * Logs success or error messages based on the outcome of the operation.
   *
   * @return {Promise<void>} Resolves when the process completes successfully or fails with an error.
   */
  async run(): Promise<void> {
    const firstname = await this.prompt.ask('Enter firstname')
    const lastname = await this.prompt.ask('Enter lastname')
    const email = await this.prompt.ask('Enter email')

    let superAdminRole = await Role.findBy('slug', 'root')

    if (!superAdminRole) {
      this.logger.error('Failed to create super admin; Super admin role not found')
      return
    }

    try {
      const createAdminUseCase = await this.app.container.make(CreateAdminUseCase)
      const admin = await createAdminUseCase.execute({
        firstname,
        lastname,
        email,
        roleId: superAdminRole.id,
      })

      this.logger.success(`Super admin created: ${admin.email}`)
    } catch (error) {
      this.logger.error('Failed to create super admin')
      this.logger.error(error.message)
    }
  }
}
