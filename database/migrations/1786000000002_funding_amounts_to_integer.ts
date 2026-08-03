import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Convertit les montants du réapprovisionnement en entiers.
 *
 * Le XOF n'a pas de subdivision : un montant décimal représente une valeur qui ne peut pas exister.
 * Le stocker en `decimal` laissait entrer `500000.50` et obligeait à convertir chaque lecture, Lucid
 * restituant les décimaux en chaîne.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_requests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('declared_amount').unsigned().notNullable().alter()
      table.bigInteger('verified_amount').unsigned().nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('declared_amount', 15, 2).notNullable().alter()
      table.decimal('verified_amount', 15, 2).nullable().alter()
    })
  }
}
