import vine from '@vinejs/vine'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

/** Pièces qu'un dossier d'entreprise accepte. */
const ENTERPRISE_PIECES = [DocumentPieceType.RCCM, DocumentPieceType.DFE]

/**
 * Dépôt d'une pièce au dossier de vérification de l'entreprise.
 *
 * Une pièce par requête : l'entreprise dépose ce qu'elle a, quand elle l'a. La référence est le
 * numéro porté par la pièce — sans elle, le dossier reste incomplet.
 */
export const submitKybPieceValidator = vine.create(
  vine.object({
    pieceType: vine.enum(ENTERPRISE_PIECES),
    reference: vine.string().trim().minLength(1),
    document: vine.file({
      size: '10mb',
      extnames: ['jpg', 'jpeg', 'png', 'pdf'],
    }),
  })
)
