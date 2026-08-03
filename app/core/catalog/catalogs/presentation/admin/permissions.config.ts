import { definePermissions } from '#core/team/domain/value_objects/permission_catalog'

/**
 * Permissions du back-office sur les types de service proposés au catalogue.
 */
export const SERVICE_TYPE_PERMISSIONS = definePermissions({
  list: {
    slug: 'service_types.list',
    name: 'Parcourir les types de service',
    description: 'Consulter la liste des types de service proposés.',
    sensitive: false,
  },

  read: {
    slug: 'service_types.read',
    name: 'Consulter un type de service',
    description: "Ouvrir le détail d'un type de service.",
    sensitive: false,
  },

  create: {
    slug: 'service_types.create',
    name: 'Créer un type de service',
    description: 'Ajouter un type de service au catalogue.',
    sensitive: true,
  },

  update: {
    slug: 'service_types.update',
    name: 'Modifier un type de service',
    description: "Changer les caractéristiques d'un type de service existant.",
    sensitive: true,
  },

  delete: {
    slug: 'service_types.delete',
    name: 'Supprimer un type de service',
    description: 'Retirer un type de service du catalogue.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les méthodes de paiement acceptées.
 */
export const PAYMENT_METHOD_PERMISSIONS = definePermissions({
  list: {
    slug: 'payment_methods.list',
    name: 'Parcourir les méthodes de paiement',
    description: 'Consulter la liste des méthodes de paiement acceptées.',
    sensitive: false,
  },

  read: {
    slug: 'payment_methods.read',
    name: 'Consulter une méthode de paiement',
    description: "Ouvrir le détail d'une méthode de paiement.",
    sensitive: false,
  },

  create: {
    slug: 'payment_methods.create',
    name: 'Créer une méthode de paiement',
    description: 'Ajouter une méthode de paiement au catalogue.',
    sensitive: true,
  },

  update: {
    slug: 'payment_methods.update',
    name: 'Modifier une méthode de paiement',
    description: "Changer les caractéristiques d'une méthode de paiement existante.",
    sensitive: true,
  },

  delete: {
    slug: 'payment_methods.delete',
    name: 'Supprimer une méthode de paiement',
    description: 'Retirer une méthode de paiement du catalogue.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les partenaires par lesquels transite l'argent.
 *
 * Désactiver un partenaire retire immédiatement les opérations qui lui étaient confiées.
 */
export const PROVIDER_PERMISSIONS = definePermissions({
  list: {
    slug: 'providers.list',
    name: 'Parcourir les providers',
    description: 'Consulter la liste des partenaires par lesquels transite l’argent.',
    sensitive: false,
  },

  read: {
    slug: 'providers.read',
    name: 'Consulter un provider',
    description: "Ouvrir le détail d'un partenaire et de son paramétrage.",
    sensitive: false,
  },

  create: {
    slug: 'providers.create',
    name: 'Créer un provider',
    description: 'Ajouter un partenaire au catalogue.',
    sensitive: true,
  },

  update: {
    slug: 'providers.update',
    name: 'Modifier un provider',
    description:
      "Changer le paramétrage d'un partenaire, y compris ce qui détermine le routage des opérations.",
    sensitive: true,
  },

  activate: {
    slug: 'providers.activate',
    name: 'Activer un provider',
    description:
      'Remettre un partenaire en service : les opérations recommencent à lui être confiées.',
    sensitive: true,
  },

  deactivate: {
    slug: 'providers.deactivate',
    name: 'Désactiver un provider',
    description: 'Retirer un partenaire du service : plus aucune opération ne lui est confiée.',
    sensitive: true,
  },

  delete: {
    slug: 'providers.delete',
    name: 'Supprimer un provider',
    description: 'Retirer un partenaire du catalogue.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les tarifications.
 *
 * Ces lignes portent les frais fixes, les pourcentages et les montants minimums appliqués à chaque
 * opération : les modifier change ce que paient les utilisateurs, avec effet immédiat.
 */
export const PRICING_PERMISSIONS = definePermissions({
  list: {
    slug: 'pricings.list',
    name: 'Parcourir les tarifications',
    description: 'Consulter les frais appliqués par couple service / méthode / partenaire.',
    sensitive: false,
  },

  read: {
    slug: 'pricings.read',
    name: 'Consulter une tarification',
    description: "Ouvrir le détail d'une ligne de tarification.",
    sensitive: false,
  },

  create: {
    slug: 'pricings.create',
    name: 'Créer une tarification',
    description:
      'Ajouter une ligne de tarification. ⚠️ Détermine ce que paieront les utilisateurs.',
    sensitive: true,
  },

  update: {
    slug: 'pricings.update',
    name: 'Modifier une tarification',
    description:
      'Changer les frais fixes, le pourcentage ou le montant minimum d’une ligne existante. ⚠️ Effet immédiat sur ce que paient les utilisateurs.',
    sensitive: true,
  },

  delete: {
    slug: 'pricings.delete',
    name: 'Supprimer une tarification',
    description:
      'Retirer une ligne de tarification, ce qui rend le couple correspondant indisponible.',
    sensitive: true,
  },
})

/**
 * Permissions du back-office sur les coordonnées publiées par la plateforme.
 */
export const COMPANY_CONTACT_PERMISSIONS = definePermissions({
  list: {
    slug: 'company_contacts.list',
    name: 'Voir les coordonnées de la société',
    description: 'Consulter les coordonnées publiées par la plateforme.',
    sensitive: false,
  },

  update: {
    slug: 'company_contacts.update',
    name: 'Modifier les coordonnées de la société',
    description: 'Changer les coordonnées publiées par la plateforme.',
    sensitive: true,
  },
})
