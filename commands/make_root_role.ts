import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'

export default class MakeRootRole extends BaseCommand {
  static commandName = 'make:root-role'
  static description = 'Create the root role with all permissions'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Executes the process for creating a root role.
   * Checks if the root role exists, creates it if not, and assigns all available permissions.
   *
   * @return {Promise<void>} Resolves when the process completes successfully or fails with an error.
   */
  async run(): Promise<void> {
    try {
      let rootRole = await Role.findBy('slug', 'root')

      if (!rootRole) {
        this.logger.info('Root role not found, creating it...')
        rootRole = await Role.create({
          slug: 'root',
          name: 'Root',
          description: 'Administrateur système avec toutes les permissions',
        })
        this.logger.success('Root role created successfully.')
      } else {
        this.logger.info('Root role already exists, updating permissions...')
      }

      const allPermissions = await Permission.all()
      const permissionIds = allPermissions.map((permission) => permission.id)

      if (permissionIds.length === 0) {
        this.logger.warning('No permissions found in the database.')
      } else {
        await rootRole.related('permissions').sync(permissionIds)
        this.logger.success(`${permissionIds.length} permissions synchronized with the root role.`)
      }
    } catch (error) {
      this.logger.error('Failed to create or update root role')
      this.logger.error(error.message)
    }
  }
}
