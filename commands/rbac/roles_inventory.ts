import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Role from '#core/team/domain/models/role'
import Admin from '#core/team/domain/models/admin'

export default class RolesInventory extends BaseCommand {
  static commandName = 'roles:inventory'
  static description = 'Liste les rôles du back-office, leurs permissions et leurs porteurs'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Affiche, pour chaque rôle, le nombre de permissions détenues et le nombre de comptes porteurs.
   *
   * @return {Promise<void>} Résout quand l'inventaire est affiché.
   */
  async run(): Promise<void> {
    const roles = await Role.query().preload('permissions').orderBy('slug')
    const admins = await Admin.all()

    const countByRole = new Map<number, number>()

    for (const admin of admins) {
      countByRole.set(admin.roleId, (countByRole.get(admin.roleId) ?? 0) + 1)
    }

    for (const role of roles) {
      const holders = countByRole.get(role.id) ?? 0
      const slugs = role.permissions.map((permission) => permission.slug)
      const hasAll = slugs.includes('all')

      this.logger.log(
        `${role.slug.padEnd(16)} ${String(slugs.length).padStart(3)} permission(s)  ${String(holders).padStart(2)} compte(s)${hasAll ? '  ⚠ porte « all »' : ''}`
      )
    }

    const orphans = admins.filter((admin) => !admin.roleId)
    this.logger.log(`\nComptes sans rôle : ${orphans.length}`)
    this.logger.log(`Comptes actifs : ${admins.filter((admin) => admin.isActive).length}`)
    this.logger.log(`Total comptes : ${admins.length}`)
  }
}
