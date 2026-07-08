import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Table `payable_aliases` (core, contexte qr) — l'alias payable §4.5.
 *
 * Un code stable (celui qu'un QR de comptoir encode) résout vers le compte qui
 * reçoit l'argent, plus un nom d'affichage dénormalisé (montré au payeur AVANT
 * paiement, sans appeler le module business : §4.5 « les produits ne s'appellent
 * pas entre eux »). Aucune FK vers accounts : le core/qr référence account_id par
 * valeur (adressage par ID).
 */
export default class extends BaseSchema {
  protected tableName = 'payable_aliases'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('code').notNullable().unique().index()
      table.uuid('account_id').notNullable().index()
      table.string('display_name').notNullable()
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}