import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les comptes utilisateurs.
 *
 * Bloquer et réactiver sont deux droits distincts : rétablir l'accès d'un compte suspendu n'est pas
 * le même geste que le suspendre, et un agent peut être habilité à l'un sans l'autre.
 */
export const USER_PERMISSIONS = definePermissions({
  usersRead: {
    slug: 'users.list',
    name: "Parcourir l'annuaire des utilisateurs",
    description: 'Consulter et rechercher la liste des comptes utilisateurs.',
    sensitive: true,
  },
  search: {
    slug: 'users.search',
    name: 'Rechercher un utilisateur',
    description:
      "Retrouver un utilisateur précis par son nom, son numéro ou son identifiant. N'ouvre pas l'annuaire : c'est le droit de l'assistance, qui répond à un client donné.",
    sensitive: false,
  },
  usersReportRead: {
    slug: 'users.export',
    name: 'Voir les statistiques des utilisateurs',
    description: "Consulter les compteurs globaux de l'annuaire.",
    sensitive: false,
  },
  userRead: {
    slug: 'users.read',
    name: "Consulter la fiche d'un utilisateur",
    description: "Ouvrir le profil d'un utilisateur : identité, statut et informations de compte.",
    sensitive: true,
  },
  userBlock: {
    slug: 'users.block',
    name: 'Bloquer un utilisateur',
    description: "Suspendre l'accès d'un utilisateur à ses comptes et à l'application.",
    sensitive: true,
  },
  userActivate: {
    slug: 'users.activate',
    name: 'Réactiver un utilisateur',
    description: "Rétablir l'accès d'un utilisateur précédemment suspendu.",
    sensitive: true,
  },
})
