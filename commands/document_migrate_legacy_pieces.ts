import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import LegacyPiecesRepository, {
  LegacyRole,
  LegacySource,
  type ConvertedPiece,
  type LegacyPieceRow,
} from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import {
  deriveStorageKey,
  isReprisableLegacyValue,
} from '#core/identity/kyc/domain/legacy_piece_url'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

const BATCH_SIZE = 500

/** Rôle porté par chaque colonne, et pièce qu'il devient sur le dossier. */
const ROLES: {
  role: LegacyRole
  pieceType: DocumentPieceType
  read: (row: LegacyPieceRow) => string | undefined
}[] = [
  { role: LegacyRole.RECTO, pieceType: DocumentPieceType.RECTO, read: (row) => row.rectoUrl },
  { role: LegacyRole.VERSO, pieceType: DocumentPieceType.VERSO, read: (row) => row.versoUrl },
  { role: LegacyRole.SELFIE, pieceType: DocumentPieceType.SELFIE, read: (row) => row.selfieUrl },
]

/** Ce que la reprise a fait, sans jamais retenir une URL ni une clé. */
interface Report {
  rows: number
  converted: number
  cleared: number
  /** Pièces déplacées sans conversion : leur valeur reste une URL, à convertir plus tard. */
  pending: number
  failed: number
}

export default class DocumentMigrateLegacyPieces extends BaseCommand {
  static commandName = 'document:migrate-legacy-pieces'
  static description =
    'Déplace les liens de dépôt vers `document_pieces`. Ne touche pas au stockage.'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Rapporte ce qui serait fait, sans rien écrire' })
  declare dryRun: boolean

  /**
   * Reprend les valeurs héritées : le dossier reçoit ses pièces, la tentative perd ses URL.
   *
   * Ne touche jamais au stockage — la fermeture des accès est un lot distinct. Le rapport ne porte
   * que des comptes : jamais une URL complète ni une clé, qui suffiraient à atteindre une pièce.
   *
   * @return {Promise<void>} Résolue quand le rapport est rendu.
   */
  async run(): Promise<void> {
    const bucket = env.get('S3_BUCKET') as string | undefined

    if (!bucket) {
      this.logger.error(
        'S3_BUCKET absent : aucune provenance ne peut être prouvée, rien ne sera repris.'
      )
      this.exitCode = 1
      return
    }

    const repository = await this.app.container.make(LegacyPiecesRepository)

    if (this.dryRun) {
      this.logger.info('Mode simulation : aucune écriture.')
    }

    const documents = await this.migrateDocuments(repository, bucket)
    const attempts = await this.clearAttempts(repository)

    this.report('Dossiers', documents)
    this.report('Tentatives', attempts)

    const failed = documents.failed + attempts.failed
    const pending = documents.pending

    if (failed > 0) {
      this.logger.error(`${failed} ligne(s) en échec — leurs colonnes portent encore leur valeur.`)
      this.logger.warning('Ne pas enchaîner le nettoyage tant qu’une ligne n’a pas été reprise.')
      this.exitCode = 1
      return
    }

    this.logger.success('Toutes les valeurs sont dans `document_pieces`.')

    if (pending > 0) {
      this.logger.warning(
        `${pending} pièce(s) portent encore une URL publique : leur conversion en clé reste à faire.`
      )
    }
  }

  /**
   * Déplace les valeurs des dossiers vers `document_pieces`, et vide leurs colonnes.
   *
   * @param {LegacyPiecesRepository} repository - Accès aux lignes héritées.
   * @param {string} bucket - Bucket dont la provenance est exigée.
   * @returns {Promise<Report>} Le compte de ce qui a été fait.
   */
  private async migrateDocuments(
    repository: LegacyPiecesRepository,
    bucket: string
  ): Promise<Report> {
    const report: Report = { rows: 0, converted: 0, cleared: 0, pending: 0, failed: 0 }

    await this.eachRow(repository, LegacySource.DOCUMENTS, async (row) => {
      report.rows += 1

      const pieces: ConvertedPiece[] = []

      for (const { role, pieceType, read } of ROLES) {
        const value = read(row)

        if (!value?.trim()) continue

        const key = isReprisableLegacyValue(value, bucket)
          ? deriveStorageKey(value, { bucket })
          : null

        if (key) {
          pieces.push({ role, pieceType, fileKey: key, isPublicUrl: false })
          continue
        }

        report.pending += 1
        pieces.push({ role, pieceType, fileKey: value.trim(), isPublicUrl: true })
      }

      if (pieces.length === 0) return

      if (this.dryRun) {
        report.converted += pieces.length
        return
      }

      try {
        await repository.convertDocument(row.id, pieces)
        report.converted += pieces.length
      } catch (error) {
        // Sa transaction est annulée : la ligne reste intacte, et les suivantes sont traitées.
        report.failed += 1
        this.logger.warning(`Dossier ${row.id} — échec d'écriture : ${(error as Error).message}`)
      }
    })

    return report
  }

  /**
   * Vide les URL des tentatives : une tentative ne porte plus de pièces (D8).
   *
   * Rien n'est déplacé — `document_pieces` n'a pas de clé étrangère vers une tentative. Ce que
   * l'historique retient d'une tentative, c'est sa décision : statut, auteur, motif.
   *
   * @param {LegacyPiecesRepository} repository - Accès aux lignes héritées.
   * @returns {Promise<Report>} Le compte de ce qui a été fait.
   */
  private async clearAttempts(repository: LegacyPiecesRepository): Promise<Report> {
    const report: Report = { rows: 0, converted: 0, cleared: 0, pending: 0, failed: 0 }

    await this.eachRow(repository, LegacySource.ATTEMPTS, async (row) => {
      report.rows += 1

      const roles: LegacyRole[] = []

      for (const { role, read } of ROLES) {
        const value = read(row)

        if (!value?.trim()) continue

        // Une tentative n'a pas de destination : ses URL sont retirées, pas déplacées (D8).
        roles.push(role)
      }

      if (roles.length === 0) return

      if (this.dryRun) {
        report.cleared += roles.length
        return
      }

      try {
        await repository.clearAttemptUrls(row.id, roles)
        report.cleared += roles.length
      } catch (error) {
        report.failed += 1
        this.logger.warning(`Tentative ${row.id} — échec d'écriture : ${(error as Error).message}`)
      }
    })

    return report
  }

  /**
   * Parcourt les lignes d'une table par curseur, lot par lot.
   *
   * En simulation, le curseur avance sur l'identifiant lu ; en exécution, les lignes traitées
   * sortent d'elles-mêmes de la sélection puisque leurs colonnes sont vidées.
   *
   * @param {LegacyPiecesRepository} repository - Accès aux lignes héritées.
   * @param {LegacySource} source - Table balayée.
   * @param {(row: LegacyPieceRow) => Promise<void>} handle - Traitement d'une ligne.
   * @returns {Promise<void>} Résolue quand la table est parcourue.
   */
  private async eachRow(
    repository: LegacyPiecesRepository,
    source: LegacySource,
    handle: (row: LegacyPieceRow) => Promise<void>
  ): Promise<void> {
    let cursor = 0

    while (true) {
      const batch = await repository.findBatchWithLegacyUrls(source, cursor, BATCH_SIZE)

      if (batch.length === 0) break

      for (const row of batch) {
        await handle(row)
        cursor = row.id
      }
    }
  }

  /** Rend le compte d'une table, sans jamais citer une valeur. */
  private report(label: string, report: Report): void {
    this.logger.info(
      `${label} — ${report.rows} ligne(s) : ${report.converted} pièce(s) créée(s), ` +
        `${report.cleared} colonne(s) vidée(s), ${report.pending} en attente de conversion, ` +
        `${report.failed} en échec.`
    )
  }
}
