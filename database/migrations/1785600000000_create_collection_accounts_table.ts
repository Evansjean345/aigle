import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * F1 — Catalogue des **comptes de collecte d'Aigle** (numéro Wave d'entreprise, RIB…).
 *
 * Le marchand les consulte pour savoir **où verser**, puis effectue son versement **hors plateforme**
 * (R-D1). Aucun flux ne traverse le système : cette table est un référentiel de consultation.
 *
 * ⚠️ `account_identifier` est **immuable** après création (R-D6) : c'est le numéro sur lequel des
 * marchands envoient de l'argent — le modifier détournerait tous les versements suivants. Changer de
 * compte = désactiver l'ancien + en créer un nouveau. Contrainte portée par l'application (aucun
 * endpoint d'écriture ne l'expose), la DB n'ayant pas de colonne « read-only ».
 *
 * Pas de suppression physique non plus : les demandes de réapprovisionnement référencent leur canal,
 * le supprimer rendrait l'historique illisible. On désactive via `is_active`.
 */
export default class extends BaseSchema {
  protected tableName = 'collection_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Clé stable citée par les demandes (plutôt que l'id auto-incrémenté).
      table.string('reference').notNullable().unique()

      table.string('label').notNullable()
      table.string('type').notNullable().index() // mobile_money | bank

      // Le numéro/IBAN sur lequel le marchand verse — unique pour éviter deux entrées identiques
      // entre lesquelles il devrait choisir.
      table.string('account_identifier').notNullable().unique()
      table.string('account_holder').notNullable()

      table.text('instructions').nullable()

      table.boolean('is_active').notNullable().defaultTo(true).index()
      table.integer('display_order').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
