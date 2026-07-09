import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Distinction d'app sur la liaison user↔device (décision #11). Le matériel
 * (`devices`) reste app-agnostique ; c'est le LIEN qui est par-app. Un même
 * téléphone peut donc être trusté indépendamment par aiglesend et aiglebusiness
 * (un `user_device` par (user, device, app)).
 *
 * Le défaut `aiglesend` backfille les lignes existantes (tout le device trust
 * actuel est aiglesend — business n'avait pas de flux device).
 */
export default class extends BaseSchema {
  protected tableName = 'user_devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('app').notNullable().defaultTo('aiglesend')
      table.index(['user_id', 'device_id', 'app', 'unlinked_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id', 'device_id', 'app', 'unlinked_at'])
      table.dropColumn('app')
    })
  }
}
