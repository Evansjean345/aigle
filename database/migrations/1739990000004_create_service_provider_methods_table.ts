import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_provider_methods'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('service_type_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('service_types')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table
        .integer('payment_method_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('payment_methods')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table
        .integer('provider_from_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('providers')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table
        .integer('provider_to_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('providers')
        .onDelete('SET NULL')
        .onUpdate('SET NULL')

      table.bigInteger('fee_fixed').defaultTo(0)
      table.decimal('fee_percent', 5, 2).defaultTo(0)
      table.string('currency', 3).defaultTo('XOF')
      table.boolean('is_active').defaultTo(true)
      /** Montant plancher de l'opération, et application des frais. */
      table.integer('min_amount').nullable()
      table.boolean('apply_feeds').nullable().defaultTo(true)

      table.unique(['service_type_id', 'payment_method_id', 'provider_from_id', 'provider_to_id'], {
        indexName: 'unique_combination',
      })

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
