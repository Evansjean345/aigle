import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur le grand livre.
 */
export const LEDGER_PERMISSIONS = definePermissions({
  list: {
    slug: 'ledgers.list',
    name: 'Parcourir le grand livre',
    description: "Consulter et rechercher l'ensemble des écritures, tous comptes confondus.",
    sensitive: true,
  },

  export: {
    slug: 'ledgers.export',
    name: 'Voir les statistiques du grand livre',
    description: 'Consulter les agrégats du grand livre sur une période.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les écritures d'un utilisateur donné.
 */
export const USER_LEDGER_PERMISSIONS = definePermissions({
  list: {
    slug: 'users.ledgers.list',
    name: "Voir les écritures d'un utilisateur",
    description: "Consulter les écritures rattachées au compte d'un utilisateur donné.",
    sensitive: false,
  },

  export: {
    slug: 'users.ledgers.export',
    name: "Voir les statistiques d'un utilisateur",
    description: "Consulter les agrégats d'écritures d'un utilisateur donné sur une période.",
    sensitive: false,
  },
})
