import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import type { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * DTOs du **catalogue des comptes de collecte** (F1) — frontière HTTP.
 *
 * Deux vues distinctes du même modèle, et la distinction est intentionnelle :
 * - **admin** : voit l'état d'activation et les dates (il administre le catalogue) ;
 * - **marchand** : voit seulement de quoi verser — ni `isActive` (toujours vrai, il ne reçoit que
 *   les actifs), ni `id', ni timestamps.
 *
 * Aucun modèle Lucid n'est renvoyé tel quel : `id', `$isPersisted` et les internes ne franchissent
 * jamais la frontière HTTP.
 */

// ── Entrées ───────────────────────────────────────────────────────────────

export interface CreateCollectionAccountCommand {
  label: string
  type: CollectionAccountType
  accountIdentifier: string
  accountHolder: string
  instructions?: string | null
  displayOrder?: number
}

/**
 * Champs modifiables. 'accountIdentifier` et `type` en sont **volontairement absents** (R-D6) :
 * les modifier détournerait les versements suivants. Changer de compte = désactiver + recréer.
 */
export interface UpdateCollectionAccountCommand {
  label?: string
  accountHolder?: string
  instructions?: string | null
  displayOrder?: number
}

// ── Sorties ───────────────────────────────────────────────────────────────

/** Vue marchand : strictement ce qu'il faut pour effectuer le versement. */
export interface CollectionAccountView {
  reference: string
  label: string
  type: CollectionAccountType
  accountIdentifier: string
  accountHolder: string
  instructions: string | null
}

/** Vue admin : la vue marchande + l'état d'administration. */
export interface CollectionAccountAdminView extends CollectionAccountView {
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

// ── Mapping ───────────────────────────────────────────────────────────────

export function toCollectionAccountView(account: CollectionAccount): CollectionAccountView {
  return {
    reference: account.reference,
    label: account.label,
    type: account.type,
    accountIdentifier: account.accountIdentifier,
    accountHolder: account.accountHolder,
    instructions: account.instructions,
  }
}

export function toCollectionAccountAdminView(
  account: CollectionAccount
): CollectionAccountAdminView {
  return {
    ...toCollectionAccountView(account),
    isActive: account.isActive,
    displayOrder: account.displayOrder,
    // Dates sérialisées en string : un DTO de sortie ne transporte pas d'objet DateTime.
    createdAt: account.createdAt.toISO() ?? '',
    updatedAt: account.updatedAt.toISO() ?? '',
  }
}
