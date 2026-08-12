/**
 * Lecture des lignes portant encore des URL de dépôt public.
 *
 * Port **temporaire**, propre au chantier de reprise : il disparaît avec les colonnes qu'il balaie,
 * une fois la migration achevée. Ne pas y ajouter de préoccupation durable.
 */

import type { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

/** Table balayée. Les deux portent les mêmes trois colonnes d'URL. */
export enum LegacySource {
  DOCUMENTS = 'kyc_documents',
  ATTEMPTS = 'kyc_attemps',
}

/** Une ligne et ses URL héritées, telles qu'elles sont en base. */
export interface LegacyPieceRow {
  id: number
  rectoUrl?: string
  versoUrl?: string
  selfieUrl?: string
}

/** Rôle porté par une colonne héritée. */
export enum LegacyRole {
  RECTO = 'recto',
  VERSO = 'verso',
  SELFIE = 'selfie',
}

/**
 * Une valeur héritée, rangée telle qu'elle sera stockée.
 *
 * `isPublicUrl` dit ce que `fileKey` contient réellement : une clé quand la provenance est prouvée,
 * l'URL d'origine sinon — en attente de conversion.
 */
export interface ConvertedPiece {
  role: LegacyRole
  pieceType: DocumentPieceType
  fileKey: string
  isPublicUrl: boolean
}

/** Une pièce dont la valeur est encore une URL publique, en attente de conversion. */
export interface PublicUrlPiece {
  id: number
  fileKey: string
}

export default abstract class LegacyPiecesRepository {
  /**
   * Compte les lignes portant au moins une URL héritée.
   *
   * @param source Table balayée.
   */
  abstract countRowsWithLegacyUrls(source: LegacySource): Promise<number>

  /**
   * Rend un lot de lignes portant au moins une URL héritée, ordonnées par identifiant croissant.
   *
   * Le parcours est piloté par un curseur plutôt que par un décalage : une reprise après
   * interruption repart où elle s'est arrêtée, sans dépendre du nombre de lignes déjà traitées.
   *
   * @param source Table balayée.
   * @param afterId Identifiant au-delà duquel lire.
   * @param limit Taille du lot.
   */
  abstract findBatchWithLegacyUrls(
    source: LegacySource,
    afterId: number,
    limit: number
  ): Promise<LegacyPieceRow[]>

  /**
   * Convertit un dossier : crée ses pièces et vide les colonnes correspondantes, en une transaction.
   *
   * Les deux écritures sont indissociables — une pièce créée sans vidage ferait resservir la même
   * image deux fois par le repli, un vidage sans pièce la ferait disparaître.
   *
   * @param id Identifiant du dossier.
   * @param pieces Valeurs jugées reprenables, avec leur clé.
   */
  abstract convertDocument(id: number, pieces: ConvertedPiece[]): Promise<void>

  /**
   * Vide les colonnes d'une tentative, sans rien créer.
   *
   * Une tentative ne porte plus de pièces : son historique retient la décision, pas les images.
   *
   * @param id Identifiant de la tentative.
   * @param roles Rôles dont la colonne est vidée.
   */
  abstract clearAttemptUrls(id: number, roles: LegacyRole[]): Promise<void>

  /**
   * Rend un lot de pièces portant encore une URL publique, ordonnées par identifiant croissant.
   *
   * @param afterId Identifiant au-delà duquel lire.
   * @param limit Taille du lot.
   */
  abstract findPublicUrlPieces(afterId: number, limit: number): Promise<PublicUrlPiece[]>

  /**
   * Remplace l'URL d'une pièce par sa clé, et la déclare signable.
   *
   * @param id Identifiant de la pièce.
   * @param fileKey Clé de stockage tirée de l'URL.
   */
  abstract convertPieceToKey(id: number, fileKey: string): Promise<void>
}
