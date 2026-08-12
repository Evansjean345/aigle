import db from '@adonisjs/lucid/services/db'
import type LegacyPiecesRepository from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import {
  LegacyRole,
  LegacySource,
  type ConvertedPiece,
  type LegacyPieceRow,
  type PublicUrlPiece,
} from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'

/** Les trois colonnes d'URL, identiques sur les deux tables balayées. */
const URL_COLUMNS = ['document_recto_url', 'document_verso_url', 'selfie_url'] as const

/** Colonne portant chaque rôle. */
const COLUMN_BY_ROLE: Record<LegacyRole, (typeof URL_COLUMNS)[number]> = {
  [LegacyRole.RECTO]: 'document_recto_url',
  [LegacyRole.VERSO]: 'document_verso_url',
  [LegacyRole.SELFIE]: 'selfie_url',
}

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

  /**
   * Convertit un dossier : crée ses pièces et vide les colonnes correspondantes, en une transaction.
   *
   * @param {number} id - Identifiant du dossier.
   * @param {ConvertedPiece[]} pieces - Valeurs reprenables, avec leur clé.
   * @returns {Promise<void>} Résolue quand les deux écritures sont commises.
   */
  async convertDocument(id: number, pieces: ConvertedPiece[]): Promise<void> {
    if (pieces.length === 0) return

    await db.transaction(async (trx) => {
      for (const piece of pieces) {
        await DocumentPiece.updateOrCreate(
          { kycDocumentId: id, pieceType: piece.pieceType },
          { fileKey: piece.fileKey, isPublicUrl: piece.isPublicUrl },
          { client: trx }
        )
      }

      await trx
        .from(LegacySource.DOCUMENTS)
        .where('id', id)
        .update(this.blankColumns(pieces.map((piece) => piece.role)))
    })
  }

  /**
   * Vide les colonnes d'une tentative, sans rien créer.
   *
   * @param {number} id - Identifiant de la tentative.
   * @param {LegacyRole[]} roles - Rôles dont la colonne est vidée.
   * @returns {Promise<void>} Résolue quand la ligne est écrite.
   */
  async clearAttemptUrls(id: number, roles: LegacyRole[]): Promise<void> {
    if (roles.length === 0) return

    await db.from(LegacySource.ATTEMPTS).where('id', id).update(this.blankColumns(roles))
  }

  /**
   * Rend un lot de pièces portant encore une URL publique.
   *
   * @param {number} afterId - Identifiant au-delà duquel lire.
   * @param {number} limit - Taille du lot.
   * @returns {Promise<PublicUrlPiece[]>} Le lot, ordonné par identifiant croissant.
   */
  async findPublicUrlPieces(afterId: number, limit: number): Promise<PublicUrlPiece[]> {
    const pieces = await DocumentPiece.query()
      .where('is_public_url', true)
      .andWhere('id', '>', afterId)
      .orderBy('id', 'asc')
      .limit(limit)

    return pieces.map((piece) => ({ id: piece.id, fileKey: piece.fileKey }))
  }

  /**
   * Remplace l'URL d'une pièce par sa clé, et la déclare signable.
   *
   * @param {number} id - Identifiant de la pièce.
   * @param {string} fileKey - Clé de stockage tirée de l'URL.
   * @returns {Promise<void>} Résolue quand la pièce est écrite.
   */
  async convertPieceToKey(id: number, fileKey: string): Promise<void> {
    await DocumentPiece.query().where('id', id).update({ file_key: fileKey, is_public_url: false })
  }

  /**
   * Rend l'affectation qui vide les colonnes des rôles donnés.
   *
   * @param {LegacyRole[]} roles - Rôles à vider.
   * @returns {Record<string, null>} Colonnes à mettre à `null`.
   */
  private blankColumns(roles: LegacyRole[]): Record<string, null> {
    return Object.fromEntries(roles.map((role) => [COLUMN_BY_ROLE[role], null]))
  }

  /**
   * Restreint la requête aux lignes dont au moins une des trois colonnes porte une valeur.
   *
   * @param {ReturnType<typeof db.from>} query - Requête à contraindre, modifiée sur place.
   */
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
