import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import type { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Contrats du catalogue des comptes de collecte.
 *
 * Canal client : ce que le marchand reçoit pour effectuer son versement. Le back-office a ses
 * propres contrats dans `dtos/admin/admin_collection_account.dto.ts` — les deux ne se dérivent pas
 * l'un de l'autre.
 */

// ── Command (input service) ─────────────────────────────────────────

export interface CreateCollectionAccountCommand {
  label: string
  type: CollectionAccountType
  accountIdentifier: string
  accountHolder: string
  instructions?: string | null
  displayOrder?: number
}

/**
 * Champs modifiables d'un compte.
 *
 * `accountIdentifier` et `type` en sont volontairement absents : ils ne sont pas modifiables.
 */
export interface UpdateCollectionAccountCommand {
  label?: string
  accountHolder?: string
  instructions?: string | null
  displayOrder?: number
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Compte de collecte tel que le voit le marchand : de quoi effectuer le versement. */
export class CollectionAccountResponseDTO {
  declare reference: string
  declare label: string
  declare type: CollectionAccountType
  declare accountIdentifier: string
  declare accountHolder: string
  declare instructions: string | null

  /**
   * Construit la vue marchand d'un compte de collecte.
   *
   * @param {CollectionAccount} account - Compte chargé depuis le repository.
   * @returns {CollectionAccountResponseDTO} La vue destinée au marchand.
   */
  static fromAccount(account: CollectionAccount): CollectionAccountResponseDTO {
    const dto = new CollectionAccountResponseDTO()
    dto.reference = account.reference
    dto.label = account.label
    dto.type = account.type
    dto.accountIdentifier = account.accountIdentifier
    dto.accountHolder = account.accountHolder
    dto.instructions = account.instructions

    return dto
  }
}
