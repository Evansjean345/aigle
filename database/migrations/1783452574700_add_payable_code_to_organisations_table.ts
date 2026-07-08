import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ajoute `payable_code` sur `organisations` — le code de l'alias payable (QR)
 * du marchand, rattaché à l'org côté produit (1 marchand = 1 QR).
 *
 * Nullable : seul un marchand (auto-LEVEL_1, encaissant) a un code ; une
 * entreprise en LEVEL_0 n'en a pas encore (obtiendra le sien à l'approbation KYB).
 * L'autorité de résolution reste le core (`payable_aliases`) ; cette colonne est
 * le rattachement métier (org → code).
 */
export default class extends BaseSchema {
  protected tableName = 'organisations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('payable_code').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('payable_code')
    })
  }
}