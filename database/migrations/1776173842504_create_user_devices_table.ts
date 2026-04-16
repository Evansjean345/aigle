import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_devices'

  async up() {
    // 1. Create user_devices table
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('(UUID())'))
      table.string('user_id').notNullable()
      table.uuid('device_id').notNullable()
      table.enum('status', ['pending', 'trusted', 'blocked', 'revoked']).defaultTo('pending')
      table.boolean('is_primary').defaultTo(false)
      table.string('push_token').nullable()
      table.string('ip_first_seen').nullable()
      table.string('ip_last_seen').nullable()
      table.boolean('is_vpn').defaultTo(false)
      table.string('first_country_code', 10).nullable()
      table.string('last_country_code', 10).nullable()
      table.timestamp('linked_at').nullable()
      table.timestamp('last_seen_at').nullable()
      table.timestamp('unlinked_at').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id'])
      table.index(['device_id'])
      table.index(['user_id', 'device_id', 'unlinked_at'])
    })

    // 2. Migrate existing data from devices to user_devices
    this.defer(async (db) => {
      const devices = await db.from('devices').select('*')

      for (const device of devices) {
        await db.table('user_devices').insert({
          id: this.raw('(UUID())'),
          user_id: device.user_id,
          device_id: device.id,
          status: device.status || 'pending',
          is_primary: device.is_primary || false,
          push_token: device.push_token || null,
          ip_first_seen: device.ip_first_seen || null,
          ip_last_seen: device.ip_last_seen || null,
          is_vpn: device.is_vpn || false,
          first_country_code: device.first_country_code || null,
          last_country_code: device.last_country_code || null,
          linked_at: device.created_at,
          last_seen_at: device.last_seen_at || null,
          unlinked_at: null,
          created_at: device.created_at,
          updated_at: device.created_at,
        })
      }
    })

    // 3. Remove migrated columns from devices
    this.schema.alterTable('devices', (table) => {
      table.dropColumn('user_id')
      table.dropColumn('status')
      table.dropColumn('is_primary')
      table.dropColumn('push_token')
      table.dropColumn('ip_first_seen')
      table.dropColumn('ip_last_seen')
      table.dropColumn('is_vpn')
      table.dropColumn('first_country_code')
      table.dropColumn('last_country_code')
      table.dropColumn('last_seen_at')
    })
  }

  async down() {
    // Restore columns on devices
    this.schema.alterTable('devices', (table) => {
      table.string('user_id').nullable()
      table.enum('status', ['pending', 'trusted', 'blocked', 'revoked']).defaultTo('pending')
      table.boolean('is_primary').defaultTo(false)
      table.string('push_token').nullable()
      table.string('ip_first_seen').nullable()
      table.string('ip_last_seen').nullable()
      table.boolean('is_vpn').defaultTo(false)
      table.string('first_country_code', 10).nullable()
      table.string('last_country_code', 10).nullable()
      table.timestamp('last_seen_at').nullable()
    })

    // Migrate data back
    this.defer(async (db) => {
      const userDevices = await db.from('user_devices').select('*')

      for (const ud of userDevices) {
        await db.from('devices').where('id', ud.device_id).update({
          user_id: ud.user_id,
          status: ud.status,
          is_primary: ud.is_primary,
          push_token: ud.push_token,
          ip_first_seen: ud.ip_first_seen,
          ip_last_seen: ud.ip_last_seen,
          is_vpn: ud.is_vpn,
          first_country_code: ud.first_country_code,
          last_country_code: ud.last_country_code,
          last_seen_at: ud.last_seen_at,
        })
      }
    })

    this.schema.dropTable(this.tableName)
  }
}
