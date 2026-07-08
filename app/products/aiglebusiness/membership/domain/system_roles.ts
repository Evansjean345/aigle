/**
 * Rôle système OWNER — seedé à la création de chaque organisation et attribué au
 * créateur. Unique par org, non supprimable/rétrogradable, porte toutes les
 * permissions du catalogue. Les autres rôles sont créés par l'organisation (Lot C).
 */
export const OWNER_ROLE_SLUG = 'owner'
export const OWNER_ROLE_NAME = 'Propriétaire'
