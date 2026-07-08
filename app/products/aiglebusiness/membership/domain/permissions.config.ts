/**
 * Catalogue des permissions business (RBAC par organisation).
 *
 * Source de vérité UNIQUE, déclarée en code (pas de table). Les rôles d'une org
 * (org_roles) composent des permissions de ce catalogue via leur slug ; le slug
 * est validé contre ce catalogue à l'écriture.
 *
 * `sensitive` : signale à l'owner, quand il compose un rôle, une permission à fort
 * impact (argent, accès, données confidentielles).
 */
export interface BusinessPermission {
  slug: string
  name: string
  description: string
  sensitive: boolean
}

export const BUSINESS_PERMISSIONS: readonly BusinessPermission[] = [
  {
    slug: 'organisation:manage',
    name: 'Gérer l’organisation',
    description: 'Modifier les informations de l’organisation.',
    sensitive: false,
  },
  {
    slug: 'members:manage',
    name: 'Gérer les membres',
    description: 'Ajouter, retirer et changer le rôle des membres.',
    sensitive: true,
  },
  {
    slug: 'roles:manage',
    name: 'Gérer les rôles',
    description: 'Créer et modifier les rôles et leurs permissions.',
    sensitive: true,
  },
  {
    slug: 'kyb:submit',
    name: 'Soumettre le KYB',
    description: 'Déposer les documents de vérification de l’entreprise.',
    sensitive: false,
  },
  {
    slug: 'kyb:view',
    name: 'Consulter le KYB',
    description: 'Voir les documents et données KYB de l’entreprise.',
    sensitive: true,
  },
  {
    slug: 'qr:manage',
    name: 'Gérer le QR marchand',
    description: 'Gérer le code de paiement marchand.',
    sensitive: false,
  },
  {
    slug: 'payout:initiate',
    name: 'Initier un paiement',
    description: 'Initier un paiement ou un paiement de masse.',
    sensitive: true,
  },
  {
    slug: 'payout:approve',
    name: 'Approuver un paiement',
    description: 'Approuver un paiement en attente (maker-checker).',
    sensitive: true,
  },
  {
    slug: 'provision:request',
    name: 'Demander un approvisionnement',
    description: 'Créer une demande d’approvisionnement du compte.',
    sensitive: true,
  },
  {
    slug: 'transactions:view',
    name: 'Voir les transactions',
    description: 'Consulter l’historique des transactions de l’organisation.',
    sensitive: false,
  },
  {
    slug: 'wallet:view',
    name: 'Voir le solde',
    description: 'Consulter le solde du compte de l’organisation.',
    sensitive: false,
  },
] as const

const PERMISSION_SLUGS: ReadonlySet<string> = new Set(BUSINESS_PERMISSIONS.map((p) => p.slug))

/** Tous les slugs du catalogue (ex : rôle OWNER = toutes les permissions). */
export function allPermissionSlugs(): string[] {
  return BUSINESS_PERMISSIONS.map((p) => p.slug)
}

/** Vrai si le slug appartient au catalogue (validation à l'écriture d'un rôle). */
export function isValidPermissionSlug(slug: string): boolean {
  return PERMISSION_SLUGS.has(slug)
}