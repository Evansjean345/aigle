import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import env from '#start/env'
import LegacyPiecesRepository from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import {
  deriveStorageKey,
  isReprisableLegacyValue,
} from '#core/identity/kyc/domain/legacy_piece_url'

const BATCH_SIZE = 500

/** Ce que la conversion a fait, sans jamais retenir une URL ni une clé. */
interface Report {
  seen: number
  converted: number
  refused: number
  failed: number
}

export default class DocumentConvertPieceUrls extends BaseCommand {
  static commandName = 'document:convert-piece-urls'
  static description =
    'Convertit en clés les pièces portant encore une URL publique. Ne touche pas au stockage.'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Rapporte ce qui serait fait, sans rien écrire' })
  declare dryRun: boolean

  /**
   * Convertit les pièces marquées publiques en pièces portant une clé signable.
   *
   * Ne lit plus les colonnes héritées : tout se joue dans `document_pieces`, où la reprise a déjà
   * rangé chaque lien. Ne touche pas au stockage — la fermeture des accès est un lot distinct, et
   * l'ordre est contraint : convertir d'abord, fermer ensuite.
   *
   * @return {Promise<void>} Résolue quand le rapport est rendu.
   */
  async run(): Promise<void> {
    const bucket = env.get('S3_BUCKET') as string | undefined

    if (!bucket) {
      this.logger.error('S3_BUCKET absent : aucune provenance ne peut être prouvée.')
      this.exitCode = 1
      return
    }

    if (this.dryRun) {
      this.logger.info('Mode simulation : aucune écriture.')
    }

    const repository = await this.app.container.make(LegacyPiecesRepository)
    const report: Report = { seen: 0, converted: 0, refused: 0, failed: 0 }

    let cursor = 0

    while (true) {
      const batch = await repository.findPublicUrlPieces(cursor, BATCH_SIZE)

      if (batch.length === 0) break

      for (const piece of batch) {
        cursor = piece.id
        report.seen += 1

        if (!isReprisableLegacyValue(piece.fileKey, bucket)) {
          // Sa provenance n'est pas prouvée : la convertir inventerait une clé pointant nulle part.
          report.refused += 1
          continue
        }

        const key = deriveStorageKey(piece.fileKey, { bucket })

        if (!key) {
          report.refused += 1
          continue
        }

        if (this.dryRun) {
          report.converted += 1
          continue
        }

        try {
          await repository.convertPieceToKey(piece.id, key)
          report.converted += 1
        } catch (error) {
          report.failed += 1
          this.logger.warning(`Pièce ${piece.id} — échec d'écriture : ${(error as Error).message}`)
        }
      }
    }

    this.logger.info(
      `${report.seen} pièce(s) en URL publique : ${report.converted} converties, ` +
        `${report.refused} refusée(s), ${report.failed} en échec.`
    )

    if (report.refused + report.failed > 0) {
      this.logger.error('Des pièces portent encore une URL : ne pas fermer les accès publics.')
      this.logger.warning(
        'Fermer S3 maintenant rendrait ces pièces illisibles — elles sont servies telles quelles.'
      )
      this.exitCode = 1
      return
    }

    this.logger.success(
      'Toutes les pièces portent une clé : les accès publics peuvent être fermés.'
    )
  }
}
