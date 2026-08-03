import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur le paiement en masse.
 *
 * Lecture seule : l'approbation d'un lot est un contrôle interne à l'organisation, et aucun
 * endpoint admin ne l'expose.
 */
export const MASS_TRANSFER_PERMISSIONS = definePermissions({
  read: {
    slug: 'mass_transfers.list',
    name: 'Superviser les paiements en masse',
    description:
      'Consulter les lots de paiement en masse de toutes les organisations et leurs bénéficiaires.',
    sensitive: false,
  },
})
