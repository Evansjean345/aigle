import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les demandes de réapprovisionnement.
 *
 * Valider crédite un portefeuille : à ne pas cumuler avec l'ajustement direct, ni avec le réglage
 * du seuil de double validation.
 */
export const FUNDING_REQUEST_PERMISSIONS = definePermissions({
  list: {
    slug: 'funding_requests.list',
    name: 'Voir les demandes de réapprovisionnement',
    description:
      'Consulter la file des déclarations de versement et leurs justificatifs. N’engage aucun mouvement d’argent.',
    sensitive: false,
  },

  review: {
    slug: 'funding_requests.review',
    name: 'Valider ou refuser un réapprovisionnement',
    description:
      "Créditer le wallet du montant vérifié, ou refuser avec motif. ⚠️ À ne pas cumuler avec l'ajustement direct de portefeuille, le réglage du seuil de double validation ni la gestion des comptes de collecte : réunis, ces droits permettent d'engager un versement et d'en valider soi-même le contrôle.",
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les réglages du réapprovisionnement.
 *
 * Qui règle le seuil de double validation règle le contrôle : ce droit ne doit pas cohabiter avec
 * celui de valider.
 */
export const FUNDING_SETTINGS_PERMISSIONS = definePermissions({
  manage: {
    slug: 'funding_settings.update',
    name: 'Régler le seuil de double validation',
    description:
      'Modifier le montant au-delà duquel un réapprovisionnement exige deux valideurs. ⚠️ À ne pas cumuler avec la validation des demandes : qui règle le seuil se dispense du second regard sur ses propres validations.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les comptes de collecte.
 *
 * Lecture et écriture séparées : le gestionnaire qui valide les demandes doit pouvoir consulter le
 * catalogue sans pouvoir y ajouter un compte qu'il contrôlerait.
 */
export const COLLECTION_ACCOUNT_PERMISSIONS = definePermissions({
  list: {
    slug: 'collection_accounts.list',
    name: 'Voir les comptes de collecte',
    description: 'Consulter le catalogue des comptes sur lesquels les marchands versent.',
    sensitive: false,
  },

  manage: {
    slug: 'collection_accounts.manage',
    name: 'Gérer les comptes de collecte',
    description:
      "Créer, modifier et désactiver les comptes de collecte — décide où arrive l'argent des marchands. ⚠️ À ne pas cumuler avec la validation des demandes : on pourrait diriger les versements vers un compte que l'on contrôle, puis les valider.",
    sensitive: true,
  },
})
