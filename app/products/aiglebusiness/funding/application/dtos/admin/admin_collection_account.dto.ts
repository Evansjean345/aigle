import type CollectionAccount from '#aiglebusiness/funding/domain/models/collection_account'
import type { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Contrats admin du catalogue des comptes de collecte.
 *
 * Canal séparé du contrat marchand (`dtos/collection_account.dto.ts`) et non dérivé de lui : les
 * champs ajoutés ici n'atteignent pas les marchands.
 */

// ── Response (output HTTP) ──────────────────────────────────────────

/** Compte de collecte tel que le voit le back-office, état d'administration compris. */
export class CollectionAccountAdminResponseDTO {
  declare reference: string
  declare label: string
  declare type: CollectionAccountType
  declare accountIdentifier: string
  declare accountHolder: string
  declare instructions: string | null
  /** Visibilité côté marchand. La désactivation remplace la suppression. */
  declare isActive: boolean
  declare displayOrder: number
  declare createdAt: string
  declare updatedAt: string

  /**
   * Construit la vue admin d'un compte de collecte.
   *
   * @param {CollectionAccount} account - Compte chargé depuis le repository.
   * @returns {CollectionAccountAdminResponseDTO} La vue destinée au back-office.
   */
  static fromAccount(account: CollectionAccount): CollectionAccountAdminResponseDTO {
    const dto = new CollectionAccountAdminResponseDTO()
    dto.reference = account.reference
    dto.label = account.label
    dto.type = account.type
    dto.accountIdentifier = account.accountIdentifier
    dto.accountHolder = account.accountHolder
    dto.instructions = account.instructions
    dto.isActive = account.isActive
    dto.displayOrder = account.displayOrder
    dto.createdAt = account.createdAt.toISO() ?? ''
    dto.updatedAt = account.updatedAt.toISO() ?? ''

    return dto
  }
}
