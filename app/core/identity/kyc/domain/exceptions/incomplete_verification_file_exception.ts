import { Exception } from '@adonisjs/core/exceptions'
import type { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Un dossier a été soumis d'un bloc alors qu'il lui manque des pièces.
 *
 * Ne concerne que les segments à soumission atomique : un dossier progressif incomplet n'est pas une
 * erreur, il attend simplement ses pièces suivantes.
 */
export default class IncompleteVerificationFileException extends Exception {
  static status = 400
  static code = 'E_INCOMPLETE_VERIFICATION_FILE'

  /** Rôles encore attendus, pour que l'appelant sache quoi redemander. */
  readonly missingPieces: DocumentPieceType[]

  constructor(missingPieces: DocumentPieceType[], message?: string) {
    super(message ?? `Pièces manquantes au dossier : ${missingPieces.join(', ')}.`, {
      status: IncompleteVerificationFileException.status,
      code: IncompleteVerificationFileException.code,
    })

    this.missingPieces = missingPieces
  }
}
