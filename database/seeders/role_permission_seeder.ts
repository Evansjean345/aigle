import { BaseSeeder } from '@adonisjs/lucid/seeders'
import type { PermissionDefinition } from '#core/team/domain/value_objects/permission_catalog'
import Role from '#core/team/domain/models/role'
import Permission from '#core/team/domain/models/permission'
import { ADMIN_PERMISSION_CATALOG } from '#start/permissions'
import { WALLET_ADJUSTMENT_PERMISSIONS } from '#core/money/wallet/presentation/admin/permissions.config'
import { REFUND_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'

/**
 * Rôles du back-office et leurs permissions.
 *
 * Les permissions elles-mêmes ne sont pas créées ici : elles sont déclarées en code et écrites en
 * base par `node ace permissions:sync`, à lancer avant ce seeder.
 *
 * Les attachements se font sans détacher : un droit accordé à la main en production survit au
 * passage du seeder.
 */
export default class extends BaseSeeder {
  async run() {
    const persisted = await Permission.all()
    const idBySlug = new Map(persisted.map((permission) => [permission.slug, permission.id]))

    /**
     * Traduit des permissions du catalogue en identifiants persistés.
     *
     * @param {readonly PermissionDefinition[]} definitions - Les permissions à attacher.
     * @returns {number[]} Leurs identifiants en base.
     * @throws {Error} Une permission du catalogue est absente de la base.
     */
    const idsOf = (definitions: readonly PermissionDefinition[]): number[] =>
      definitions.map((definition) => {
        const id = idBySlug.get(definition.slug)

        if (id === undefined) {
          throw new Error(
            `Permission absente de la base : ${definition.slug}. Lancez « node ace permissions:sync » avant ce seeder.`
          )
        }

        return id
      })

    const superAdmin = await Role.updateOrCreate(
      { slug: 'super_admin' },
      { name: 'Super Administrateur', description: 'Accès total au système' }
    )
    await superAdmin.related('permissions').sync(idsOf(ADMIN_PERMISSION_CATALOG), false)

    await Role.updateOrCreate(
      { slug: 'admin' },
      { name: 'Administrateur', description: 'Gestionnaire opérationnel avec droits étendus' }
    )

    await Role.updateOrCreate(
      { slug: 'kyc_agent' },
      { name: 'Agent KYC', description: 'Spécialiste de la conformité et validation des documents' }
    )

    const financeAdmin = await Role.updateOrCreate(
      { slug: 'finance_admin' },
      { name: 'Administrateur Finance', description: 'Responsable du suivi des flux financiers' }
    )
    await financeAdmin
      .related('permissions')
      .sync(
        idsOf([
          WALLET_ADJUSTMENT_PERMISSIONS.execute,
          WALLET_ADJUSTMENT_PERMISSIONS.list,
          REFUND_PERMISSIONS.execute,
          REFUND_PERMISSIONS.list,
        ]),
        false
      )

    await Role.updateOrCreate(
      { slug: 'support_agent' },
      { name: 'Agent Support', description: 'Support client de premier niveau' }
    )
  }
}
