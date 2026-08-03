import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Réglages du réapprovisionnement. Table à ligne unique.
 *
 * Aucune valeur par défaut n'est insérée ici : l'absence de ligne doit faire échouer la validation
 * plutôt que de laisser passer un dossier sans contrôle. Le seeder pose la valeur initiale.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Au-delà de ce montant déclaré, une demande exige deux valideurs distincts.
      // Entier : le XOF n'a pas de subdivision. `bigInteger` et non `integer`, dont le plafond de
      // 2,1 milliards serait atteignable pour un seuil.
      table.bigInteger('double_approval_threshold').unsigned().notNullable()

      table.integer('updated_by_admin_id').unsigned().nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
