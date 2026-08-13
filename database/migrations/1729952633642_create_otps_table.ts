import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'otps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // `users_uid` et non la clé auto-incrémentée : c'est l'identifiant public que le code porte.
      table.uuid('user_id').nullable()
      table.string('otp_code').notNullable()
      table.integer('attempts').nullable().defaultTo(0)
      table.string('phone').nullable().index()
      table.string('email', 225).nullable()
      /** Canal par lequel le code est envoyé. */
      table.enum('target', ['mobile', 'email']).nullable().index()

      table.timestamp('expires_at').nullable()
      table.timestamp('locked_until').nullable() // temps de verrouillage
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
