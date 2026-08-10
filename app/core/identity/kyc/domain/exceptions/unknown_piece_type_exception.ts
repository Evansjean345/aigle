import { Exception } from '@adonisjs/core/exceptions'
import type { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Une pièce a été déposée alors que le dossier ne l'attend pas.
 *
 * Refusée plutôt qu'ignorée : accepter un selfie dans un dossier d'entreprise reviendrait à stocker
 * une donnée personnelle que personne ne lira jamais.
 */
export default class UnknownPieceTypeException extends Exception {
  static status = 400
  static code = 'E_UNKNOWN_PIECE_TYPE'

  constructor(pieceType: DocumentPieceType) {
    super(`Ce dossier n'attend pas de pièce « ${pieceType} ».`, {
      status: UnknownPieceTypeException.status,
      code: UnknownPieceTypeException.code,
    })
  }
}
