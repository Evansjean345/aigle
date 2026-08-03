import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur le portefeuille d'un utilisateur.
 *
 * Geler et dégeler sont deux droits distincts : rétablir les mouvements sur un compte suspendu
 * n'est pas le même geste que les interrompre.
 */
export const USER_WALLET_PERMISSIONS = definePermissions({
  read: {
    slug: 'users.wallets.read',
    name: "Voir le portefeuille d'un utilisateur",
    description: "Consulter le solde et les volumes du portefeuille d'un utilisateur.",
    sensitive: true,
  },

  freeze: {
    slug: 'users.wallets.freeze',
    name: "Geler le portefeuille d'un utilisateur",
    description: "Suspendre un portefeuille : plus aucun mouvement n'y est accepté.",
    sensitive: true,
  },

  unfreeze: {
    slug: 'users.wallets.unfreeze',
    name: "Dégeler le portefeuille d'un utilisateur",
    description: 'Rétablir les mouvements sur un portefeuille précédemment gelé.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les ajustements de portefeuille.
 *
 * Exécuter un ajustement ne doit pas cohabiter avec la validation des réapprovisionnements dans un
 * même rôle : créditer directement dispenserait de passer par la demande.
 */
export const WALLET_ADJUSTMENT_PERMISSIONS = definePermissions({
  execute: {
    slug: 'wallet_adjustments.execute',
    name: 'Exécuter un ajustement de portefeuille',
    description:
      'Créditer ou débiter un portefeuille pour rapprochement comptable, sans transaction correspondante. ⚠️ À ne pas cumuler avec la validation des réapprovisionnements : créditer directement dispenserait de passer par la demande.',
    sensitive: true,
  },

  list: {
    slug: 'wallet_adjustments.list',
    name: 'Voir les ajustements de portefeuille',
    description: "Consulter l'historique des ajustements et leur justification.",
    sensitive: false,
  },
})
