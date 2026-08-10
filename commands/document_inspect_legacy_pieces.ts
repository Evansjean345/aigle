import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import LegacyPiecesRepository, {
  LegacySource,
} from '#core/identity/kyc/domain/interfaces/legacy_pieces_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { deriveStorageKey, urlPrefix } from '#core/identity/kyc/domain/legacy_piece_url'
import { DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'

const BATCH_SIZE = 500
const DEFAULT_SAMPLE = 100

/** Ce que le balayage a constaté, sans jamais retenir une URL ni une clé. */
interface Findings {
  rows: number
  urlsByRole: Record<string, number>
  prefixes: Map<string, number>
  underivable: number
}

export default class DocumentInspectLegacyPieces extends BaseCommand {
  static commandName = 'document:inspect-legacy-pieces'
  static description =
    'Inventorie les pièces encore désignées par une URL de dépôt public. Ne modifie rien.'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Sonde chaque objet au lieu d’un échantillon' })
  declare all: boolean

  @flags.number({ description: 'Taille de l’échantillon sondé (défaut : 100)' })
  declare sample: number

  /**
   * Constate l'état des pièces héritées, en base puis sur le stockage.
   *
   * Le rapport ne porte que des comptes et des préfixes : jamais une URL complète ni une clé
   * entière, qui suffiraient à atteindre une pièce d'identité.
   *
   * @return {Promise<void>} Résolue quand le rapport est rendu.
   */
  async run(): Promise<void> {
    const repository = await this.app.container.make(LegacyPiecesRepository)
    const storage = await this.app.container.make(FileStorageService)

    const keys: string[] = []
    const perSource = new Map<LegacySource, Findings>()

    for (const source of [LegacySource.DOCUMENTS, LegacySource.ATTEMPTS]) {
      perSource.set(source, await this.scan(repository, source, keys))
    }

    this.reportDatabase(perSource)
    await this.reportStorage(storage, keys)
  }

  /**
   * Parcourt une table par lots et agrège ce qu'elle contient.
   *
   * @param {LegacyPiecesRepository} repository - Dépôt de lecture.
   * @param {LegacySource} source - Table balayée.
   * @param {string[]} keys - Collecteur des clés dérivées, alimenté au fil du parcours.
   * @returns {Promise<Findings>} Comptes, formes rencontrées et anomalies.
   */
  private async scan(
    repository: LegacyPiecesRepository,
    source: LegacySource,
    keys: string[]
  ): Promise<Findings> {
    const findings: Findings = {
      rows: await repository.countRowsWithLegacyUrls(source),
      urlsByRole: {
        [DocumentPieceType.RECTO]: 0,
        [DocumentPieceType.VERSO]: 0,
        [DocumentPieceType.SELFIE]: 0,
      },
      prefixes: new Map(),
      underivable: 0,
    }

    let cursor = 0

    for (;;) {
      const batch = await repository.findBatchWithLegacyUrls(source, cursor, BATCH_SIZE)
      if (batch.length === 0) break

      for (const row of batch) {
        const urls: [DocumentPieceType, string | undefined][] = [
          [DocumentPieceType.RECTO, row.rectoUrl],
          [DocumentPieceType.VERSO, row.versoUrl],
          [DocumentPieceType.SELFIE, row.selfieUrl],
        ]

        for (const [role, url] of urls) {
          if (!url) continue

          findings.urlsByRole[role] += 1

          const prefix = urlPrefix(url)
          findings.prefixes.set(prefix, (findings.prefixes.get(prefix) ?? 0) + 1)

          const key = deriveStorageKey(url)

          if (key) keys.push(key)
          else findings.underivable += 1
        }
      }

      cursor = batch[batch.length - 1].id
    }

    return findings
  }

  /**
   * Rend au terminal ce que la base contient, table par table.
   *
   * @param {Map<LegacySource, Findings>} perSource - Ce que le balayage a relevé.
   */
  private reportDatabase(perSource: Map<LegacySource, Findings>): void {
    this.logger.info('— Base —')

    for (const [source, findings] of perSource) {
      const total = Object.values(findings.urlsByRole).reduce((sum, count) => sum + count, 0)

      this.logger.info(`${source} : ${findings.rows} ligne(s), ${total} URL`)

      for (const [role, count] of Object.entries(findings.urlsByRole)) {
        this.logger.info(`  ${role} : ${count}`)
      }

      if (findings.underivable > 0) {
        this.logger.warning(`  ${findings.underivable} URL dont aucune clé ne se déduit`)
      }

      this.logger.info('  formes rencontrées :')
      for (const [prefix, count] of [...findings.prefixes].sort((a, b) => b[1] - a[1])) {
        this.logger.info(`    ${prefix} → ${count}`)
      }
    }
  }

  /**
   * Sonde le stockage et rend l'état des objets.
   *
   * Interrompt le rapport et positionne un code de sortie non nul si le stockage ne répond pas :
   * une panne de transport ne se lit pas comme un inventaire de fichiers absents.
   *
   * @param {FileStorageService} storage - Accès au stockage.
   * @param {string[]} keys - Clés dérivées des URL rencontrées, doublons compris.
   * @returns {Promise<void>} Résolue quand le rapport est rendu.
   */
  private async reportStorage(storage: FileStorageService, keys: string[]): Promise<void> {
    const unique = [...new Set(keys)]
    const limit = this.all ? unique.length : Math.min(this.sample || DEFAULT_SAMPLE, unique.length)
    const probed = unique.slice(0, limit)

    this.logger.info('— Stockage —')
    this.logger.info(
      `${unique.length} clé(s) distincte(s) ; ${probed.length} sondée(s)${this.all ? '' : ' (échantillon, --all pour tout sonder)'}`
    )

    let present = 0
    let alreadyPrivate = 0
    let absent = 0

    for (const key of probed) {
      const probe = await storage.probeObject(key)

      if (probe.state === 'unreachable') {
        this.logger.error(`Le stockage ne répond pas : ${probe.reason}`)
        this.logger.error(
          'Rapport interrompu — un stockage muet ne se lit pas comme des objets absents.'
        )
        this.exitCode = 1

        return
      }

      if (probe.state === 'absent') {
        absent += 1
        continue
      }

      present += 1
      if (probe.visibility === 'private') alreadyPrivate += 1
    }

    this.logger.info(`  présents : ${present}`)
    this.logger.info(`  dont déjà privés : ${alreadyPrivate}`)
    this.logger.info(`  absents du bucket : ${absent}`)
  }
}
