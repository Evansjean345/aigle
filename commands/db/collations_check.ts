import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

/** Colonne de texte et sa collation. */
interface ColumnCollation {
  table: string
  column: string
  collation: string
  dataType: string
}

export default class DbCollationsCheck extends BaseCommand {
  static commandName = 'db:collations:check'
  static description = 'Relève les collations divergentes entre colonnes de jointure'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    description: 'Collation attendue. Par défaut, la plus répandue de la base',
  })
  declare expect: string

  /**
   * Relève la collation de chaque colonne de texte et signale celles qui s'écartent de l'attendue.
   *
   * Deux colonnes de collations différentes ne peuvent pas être comparées : la requête échoue à
   * l'exécution, jamais à la compilation.
   *
   * @returns {Promise<void>} Résout après le constat ; le code de sortie porte le verdict.
   */
  async run(): Promise<void> {
    const rows = await db.rawQuery(
      'SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME, DATA_TYPE FROM information_schema.COLUMNS ' +
        'WHERE TABLE_SCHEMA = DATABASE() AND COLLATION_NAME IS NOT NULL ' +
        // Une collation binaire est portée par les colonnes JSON, que MariaDB matérialise en
        // `longtext` : elle est imposée par le moteur, pas héritée d'un défaut.
        "AND COLLATION_NAME NOT LIKE '%\\_bin' " +
        'ORDER BY TABLE_NAME, COLUMN_NAME'
    )

    const columns: ColumnCollation[] = (rows[0] ?? rows).map((row: Record<string, string>) => ({
      table: row.TABLE_NAME,
      column: row.COLUMN_NAME,
      collation: row.COLLATION_NAME,
      dataType: row.DATA_TYPE,
    }))

    const byCollation = new Map<string, ColumnCollation[]>()

    for (const column of columns) {
      const bucket = byCollation.get(column.collation) ?? []
      bucket.push(column)
      byCollation.set(column.collation, bucket)
    }

    const sorted = [...byCollation].sort((a, b) => b[1].length - a[1].length)

    this.logger.info(`${columns.length} colonne(s) de texte, ${sorted.length} collation(s).`)

    for (const [collation, group] of sorted) {
      this.logger.log(`  ${collation} : ${group.length} colonne(s)`)
    }

    const expected = this.expect ?? sorted[0][0]
    const deviant = columns.filter((column) => column.collation !== expected)

    if (deviant.length === 0) {
      this.logger.success(`Toutes les colonnes sont en « ${expected} ».`)
      return
    }

    this.logger.warning(`${deviant.length} colonne(s) hors de « ${expected} » :`)

    for (const column of deviant) {
      this.logger.log(`  ! ${column.table}.${column.column} — ${column.collation}`)
    }

    this.exitCode = 1
  }
}
