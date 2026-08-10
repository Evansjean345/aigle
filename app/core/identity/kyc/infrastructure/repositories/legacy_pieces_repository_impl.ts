import db from '@adonisjs/lucid/services/db'
import type LegacyPiecesRepository from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import {
  LegacySource,
  type LegacyPieceRow,
} from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'

/** Les trois colonnes d'URL, identiques sur les deux tables balayées. */
const URL_COLUMNS = ['document_recto_url', 'document_verso_url', 'selfie_url'] as const

/**
 * Balayage des lignes portant encore des URL de dépôt public.
 *
 * Passe par le constructeur de requêtes plutôt que par les modèles : la reprise lit des colonnes que
 * le modèle a cessé d'écrire, et n'a besoin ni des relations ni des accesseurs.
 */
export default class LegacyPiecesRepositoryImpl implements LegacyPiecesRepository {
  /**
   * Compte les lignes portant au moins une URL héritée.
   *
   * @param {LegacySource} source - Table balayée.
   * @returns {Promise<number>} Le nombre de lignes.
   */
  async countRowsWithLegacyUrls(source: LegacySource): Promise<number> {
    const query = db.from(source)

    this.whereAnyUrlPresent(query)

    const result = await query.count('* as total').first()

    return Number(result?.total ?? 0)
  }

  /**
   * Rend un lot de lignes portant au moins une URL héritée, au-delà d'un identifiant.
   *
   * @param {LegacySource} source - Table balayée.
   * @param {number} afterId - Identifiant au-delà duquel lire.
   * @param {number} limit - Taille du lot.
   * @returns {Promise<LegacyPieceRow[]>} Le lot, ordonné par identifiant croissant.
   */
  async findBatchWithLegacyUrls(
    source: LegacySource,
    afterId: number,
    limit: number
  ): Promise<LegacyPieceRow[]> {
    const query = db
      .from(source)
      .select('id', ...URL_COLUMNS)
      .where('id', '>', afterId)

    this.whereAnyUrlPresent(query)

    const rows = await query.orderBy('id', 'asc').limit(limit)

    return rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      rectoUrl: (row.document_recto_url as string) ?? undefined,
      versoUrl: (row.document_verso_url as string) ?? undefined,
      selfieUrl: (row.selfie_url as string) ?? undefined,
    }))
  }

  /** Restreint aux lignes dont au moins une des trois colonnes porte une valeur. */
  private whereAnyUrlPresent(query: ReturnType<typeof db.from>): void {
    query.where((builder) => {
      for (const column of URL_COLUMNS) {
        builder.orWhere((inner) => {
          inner.whereNotNull(column).andWhereNot(column, '')
        })
      }
    })
  }
}
