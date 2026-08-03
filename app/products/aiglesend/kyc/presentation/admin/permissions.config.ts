import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les dossiers de vérification d'identité.
 *
 * Approuver et refuser sont deux droits distincts : un agent peut être habilité à rejeter un
 * document non conforme sans pouvoir valider une identité.
 */
export const KYC_PERMISSIONS = definePermissions({
  read: {
    slug: 'kyc_documents.read',
    name: 'Voir les dossiers de vérification',
    description: "Consulter la file des dossiers, les documents soumis et les pièces d'identité.",
    sensitive: true,
  },

  approve: {
    slug: 'kyc_documents.approve',
    name: 'Approuver une vérification',
    description:
      "Valider l'identité d'un utilisateur, ce qui relève son palier et donc ses limites d'opération.",
    sensitive: true,
  },

  reject: {
    slug: 'kyc_documents.reject',
    name: 'Refuser une vérification',
    description: 'Rejeter un document avec motif et demander une nouvelle soumission.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les paliers de vérification.
 *
 * Les limites que portent ces paliers s'appliquent aux montants que les utilisateurs peuvent
 * engager : les modifier change ce que chacun peut faire de son argent.
 */
export const KYC_LEVEL_PERMISSIONS = definePermissions({
  list: {
    slug: 'kyc_levels.list',
    name: 'Voir les paliers de vérification',
    description: 'Consulter les paliers et les limites de montant qui leur sont attachées.',
    sensitive: false,
  },

  manage: {
    slug: 'kyc_levels.manage',
    name: 'Gérer les paliers de vérification',
    description:
      "Créer, modifier et supprimer les paliers. Les limites qu'ils portent s'appliquent aux montants que les utilisateurs peuvent engager.",
    sensitive: true,
  },
})
