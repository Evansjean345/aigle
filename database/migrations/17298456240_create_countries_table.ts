import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'countries'

  public async up() {
    // this.schema.createTable(this.tableName, (table) => {
    //   table.increments('id').unsigned()
    //   table.string('name').notNullable()
    //   table.string('flag').notNullable()
    //   table.string('iso_code').defaultTo('CI').index()
    //   table.string('status').defaultTo('active')
    //   table.string('currency_code').defaultTo('XOF')
    //   table.string('currency_symbol').nullable()
    //   table.string('phone_code').notNullable()
    //   table.timestamp('created_at', { useTz: true })
    //   table.timestamp('updated_at', { useTz: true })
    // })
  }

  public async down() {
    // Supprimer la table
    this.schema.dropTable(this.tableName)
  }
}
