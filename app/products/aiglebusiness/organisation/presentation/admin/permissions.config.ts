import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les organisations marchandes.
 *
 * Suspendre l'encaissement coupe les revenus d'un marchand : ce droit est distinct de la
 * consultation, et le restera.
 */
export const ORGANISATION_PERMISSIONS = definePermissions({
  list: {
    slug: 'organisations.list',
    name: 'Parcourir les organisations',
    description: 'Consulter et rechercher la liste des organisations marchandes.',
    sensitive: false,
  },
  read: {
    slug: 'organisations.read',
    name: "Consulter la fiche d'une organisation",
    description: "Ouvrir la fiche d'une organisation : identité, propriétaire et statut.",
    sensitive: false,
  },
  payable: {
    slug: 'organisations.payable',
    name: "Gérer l'encaissement d'une organisation",
    description:
      "Ouvrir ou suspendre le QR d'encaissement. Suspendre fait refuser tout paiement présentant ce QR.",
    sensitive: true,
  },
  provisioningReview: {
    slug: 'organisations.provisioning.review',
    name: 'Reprendre une organisation bloquée en configuration',
    description:
      "Voir les organisations dont la création ne s'est pas achevée et relancer leur configuration. Le geste est le même que la reprise automatique, exécuté sans attendre.",
    sensitive: false,
  },
  block: {
    slug: 'organisations.block',
    name: 'Bloquer ou débloquer une organisation',
    description:
      "Bloquer coupe l'accès de tous les membres, révoque leurs sessions business et gèle le portefeuille. Débloquer rend l'accès, mais jamais le portefeuille : le dégel demande le droit dédié.",
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les membres d'une organisation.
 *
 * La liste expose l'identité de personnes tierces : elle ne se confond pas avec la consultation de
 * l'organisation elle-même.
 */
export const ORGANISATION_MEMBER_PERMISSIONS = definePermissions({
  list: {
    slug: 'organisations.members.list',
    name: "Voir les membres d'une organisation",
    description: "Consulter les membres d'une organisation, leur identité et leur rôle.",
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les rôles internes d'une organisation.
 */
export const ORGANISATION_ROLE_PERMISSIONS = definePermissions({
  list: {
    slug: 'organisations.roles.list',
    name: "Voir les rôles d'une organisation",
    description: "Consulter les rôles définis par une organisation et les droits qu'ils portent.",
    sensitive: false,
  },
})

/**
 * Permissions du back-office sur le portefeuille d'une organisation.
 */
export const ORGANISATION_WALLET_PERMISSIONS = definePermissions({
  read: {
    slug: 'organisations.wallets.read',
    name: "Voir le portefeuille d'une organisation",
    description: 'Consulter le solde et les volumes encaissés par un marchand.',
    sensitive: true,
  },
  freeze: {
    slug: 'organisations.wallets.freeze',
    name: "Geler le portefeuille d'une organisation",
    description:
      'Faire refuser tout encaissement et tout décaissement, y compris les lots de paiement déjà approuvés, dont les lignes restantes attendent sans être versées ni rendues.',
    sensitive: true,
  },

  unfreeze: {
    slug: 'organisations.wallets.unfreeze',
    name: "Dégeler le portefeuille d'une organisation",
    description:
      "Rétablir les mouvements d'une organisation. Seul moyen de rendre l'argent après un blocage, que le déblocage ne rend pas. Exige une organisation active.",
    sensitive: true,
  },
})
