/**
 * Lecture des lignes portant encore des URL de dépôt public.
 *
 * Port **temporaire**, propre au chantier de reprise : il disparaît avec les colonnes qu'il balaie,
 * une fois la migration achevée. Ne pas y ajouter de préoccupation durable.
 */

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
}
