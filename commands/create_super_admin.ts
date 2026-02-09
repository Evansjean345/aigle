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
    const password = await this.prompt.secure('Enter password')

    try {
      let superAdminRole = await Role.findBy('slug', 'super_admin')

      if (!superAdminRole) {
        this.logger.info('Super admin role not found, creating it...')
        superAdminRole = await Role.create({
          slug: 'super_admin',
          name: 'Super Administrateur',
          description: 'Accès total au système',
        })
      }

      const createAdminUseCase = await this.app.container.make(CreateAdminUseCase)
      const admin = await createAdminUseCase.execute({
        firstname,
        lastname,
        email,
        password,
        roleId: superAdminRole.id,
      })

      this.logger.success(`Super admin created: ${admin.email}`)
    } catch (error) {
      this.logger.error('Failed to create super admin')
      this.logger.error(error.message)
    }
  }
}
