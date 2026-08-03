import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur le registre des transactions.
 */
export const TRANSACTION_PERMISSIONS = definePermissions({
  list: {
    slug: 'transactions.list',
    name: 'Parcourir les transactions',
    description: "Consulter et rechercher l'ensemble des transactions, tous comptes confondus.",
    sensitive: true,
  },

  read: {
    slug: 'transactions.read',
    name: 'Consulter une transaction',
    description: "Ouvrir le détail d'une transaction identifiée par sa référence.",
    sensitive: false,
  },

  export: {
    slug: 'transactions.export',
    name: 'Voir les statistiques de transactions',
    description: 'Consulter les agrégats de transactions sur une période.',
    sensitive: true,
  },

  ledger: {
    slug: 'transactions.ledgers.read',
    name: "Voir les écritures d'une transaction",
    description: 'Consulter les écritures comptables produites par une transaction.',
    sensitive: false,
  },
})

/**
 * Permissions du back-office sur les transactions d'un utilisateur donné.
 *
 * Distinctes du registre global : consulter l'activité d'un client n'emporte pas le droit de
 * parcourir celle de tous les autres.
 */
export const USER_TRANSACTION_PERMISSIONS = definePermissions({
  list: {
    slug: 'users.transactions.list',
    name: "Voir les transactions d'un utilisateur",
    description: "Consulter les transactions du compte d'un utilisateur donné.",
    sensitive: false,
  },

  export: {
    slug: 'users.transactions.export',
    name: "Voir les statistiques d'un utilisateur",
    description: "Consulter les agrégats de transactions d'un utilisateur donné sur une période.",
    sensitive: false,
  },
})

/**
 * Permissions du back-office sur les remboursements.
 *
 * Rembourser rend de l'argent : à ne pas cumuler avec l'ajustement direct de portefeuille, qui
 * permettrait le même mouvement sans trace de remboursement.
 */
export const REFUND_PERMISSIONS = definePermissions({
  execute: {
    slug: 'refunds.execute',
    name: 'Rembourser une transaction',
    description: "Rendre manuellement le montant d'une transaction à son émetteur.",
    sensitive: true,
  },

  list: {
    slug: 'refunds.list',
    name: 'Voir les remboursements',
    description: "Consulter l'historique des remboursements, automatiques comme manuels.",
    sensitive: false,
  },
})
