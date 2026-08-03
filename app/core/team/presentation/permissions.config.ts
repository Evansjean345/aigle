import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les comptes d'administration.
 */
export const ADMIN_PERMISSIONS = definePermissions({
  manage: {
    slug: 'admins.manage',
    name: 'Gérer les administrateurs',
    description:
      'Créer, modifier et désactiver des comptes d’administration, et leur attribuer un rôle.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les rôles.
 *
 * Composer un rôle revient à choisir ce que ses porteurs pourront faire : qui détient ce droit peut
 * s'attribuer n'importe quel autre droit du catalogue.
 */
export const ROLE_PERMISSIONS = definePermissions({
  manage: {
    slug: 'roles.manage',
    name: 'Gérer les rôles',
    description:
      'Créer, modifier et supprimer des rôles, et choisir les permissions qu’ils portent. ⚠️ Permet de s’attribuer n’importe quel droit du catalogue.',
    sensitive: true,
  },
})
