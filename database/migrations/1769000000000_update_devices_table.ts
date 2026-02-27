import { BaseSchema } from '@adonisjs/lucid/schema'
import string from '@adonisjs/core/helpers/string'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop old columns
      table.dropColumn('token')
      table.dropColumn('ios_app_version')
      table.dropColumn('android_app_version')
      table.dropColumn('platform_version')
      table.dropColumn('user_agent')
      table.dropColumn('updated_at')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Change id from increments to uuid
      table.dropColumn('id')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(string.random(32))
      table.string('user_id').notNullable().alter()
      table.string('fingerprint_hash').notNullable()
      table.uuid('device_uid').notNullable()
      table.string('brand').nullable()
      table.string('model').nullable()
      table.string('os_version').nullable()
      table.boolean('is_emulator').defaultTo(false)
      table.boolean('is_rooted').defaultTo(false)
      table.string('ip_first_seen').nullable()
      table.string('ip_last_seen').nullable()
      table.enum('status', ['pending', 'trusted', 'blocked', 'revoked']).defaultTo('pending')
      table.timestamp('last_seen_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Remove new columns
      table.dropColumn('fingerprint_hash')
      table.dropColumn('device_uid')
      table.dropColumn('brand')
      table.dropColumn('model')
      table.dropColumn('os_version')
      table.dropColumn('is_emulator')
      table.dropColumn('is_rooted')
      table.dropColumn('ip_first_seen')
      table.dropColumn('ip_last_seen')
      table.dropColumn('status')
      table.dropColumn('last_seen_at')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('id')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Restore old columns
      table.increments('id')
      table.text('token')
      table.string('user_id').nullable().defaultTo(null).alter()
      table.string('ios_app_version').nullable().defaultTo(null)
      table.string('android_app_version').nullable().defaultTo(null)
      table.string('platform_version').nullable().defaultTo(null)
      table.string('user_agent').nullable().defaultTo(null)
      table.timestamp('updated_at')
    })
  }
}
