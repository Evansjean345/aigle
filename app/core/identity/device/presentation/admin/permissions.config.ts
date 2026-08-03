import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les appareils des utilisateurs.
 *
 * Révoquer un appareil déconnecte son porteur et lui redemande une vérification complète : c'est un
 * droit distinct de la consultation.
 */
export const DEVICE_PERMISSIONS = definePermissions({
  devicesRead: {
    slug: 'devices.list',
    name: 'Parcourir les appareils',
    description:
      'Consulter la liste des appareils enrôlés, tous utilisateurs confondus ou pour un utilisateur donné.',
    sensitive: true,
  },
  deviceRead: {
    slug: 'devices.read',
    name: 'Consulter un appareil',
    description:
      "Ouvrir la fiche d'un appareil : comptes rattachés, activité et transactions associées.",
    sensitive: true,
  },

  deviceRevoke: {
    slug: 'devices.revoke',
    name: 'Révoquer un appareil',
    description:
      'Retirer la confiance accordée à un appareil : son porteur est déconnecté et devra vérifier son identité à nouveau.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les versions publiées de l'application mobile.
 *
 * Ces entrées portent `minVersion`, `criticalUpdate` et le lien de téléchargement que le mobile
 * consulte pour décider d'une mise à jour : les écrire engage toute la flotte installée.
 */
export const APP_VERSION_PERMISSIONS = definePermissions({
  list: {
    slug: 'app_versions.list',
    name: "Parcourir les versions de l'application",
    description: 'Consulter les versions publiées et leurs contraintes de mise à jour.',
    sensitive: false,
  },
  read: {
    slug: 'app_versions.read',
    name: 'Consulter une version',
    description: "Ouvrir le détail d'une version publiée.",
    sensitive: false,
  },
  create: {
    slug: 'app_versions.create',
    name: 'Publier une version',
    description:
      "Publier une version de l'application mobile. ⚠️ Engage toute la flotte installée : une version minimale trop haute rend l'application inutilisable.",
    sensitive: true,
  },
  update: {
    slug: 'app_versions.update',
    name: 'Modifier une version',
    description:
      "Changer la version minimale, le caractère critique ou le lien de téléchargement d'une version publiée.",
    sensitive: true,
  },
  delete: {
    slug: 'app_versions.delete',
    name: 'Retirer une version',
    description: 'Supprimer une version publiée du catalogue des mises à jour.',
    sensitive: true,
  },
})
