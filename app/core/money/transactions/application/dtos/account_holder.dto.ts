import type { UserLookupResult } from '#core/identity/user/application/dtos/user_lookup_result'

/**
 * Contrat de résolution des titulaires de comptes.
 */

// ── Result (output service) ─────────────────────────────────────────

/**
 * Titulaire d'un compte : une personne, ou le nom commercial d'une organisation.
 *
 * Les deux champs sont exclusifs — un compte appartient à l'un ou à l'autre. Tous deux à `null`
 * signifie que le compte n'a pas été retrouvé.
 */
export interface AccountHolderResult {
  user: UserLookupResult | null
  merchantName: string | null
}