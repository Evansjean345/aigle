import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Table `organisations` — appartient au PRODUIT business (aiglebusiness).
 *
 * Invariant produit↔core : AUCUNE FK vers le core. `owner_user_id` référence un
 * users_uid par valeur (pas de contrainte), et le compte money de l'org est
 * atteint via `account_id = organisation_id` (dérivé) côté core, sans jointure.
 */
export default class extends BaseSchema {
  protected tableName = 'organisations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('organisation_id').notNullable().unique().index()
      table.uuid('owner_user_id').notNullable().index()
      table.string('name').notNullable()
      table.string('account_type').notNullable()
      table.string('level').notNullable().defaultTo('level_0')
      table.string('status').notNullable().defaultTo('active')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
