import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Une pièce dit si sa valeur est déjà une clé, ou encore une URL publique héritée.
 *
 * La reprise range **tous** les liens dans `document_pieces`, y compris ceux qu'elle ne sait pas
 * encore convertir en clé. L'information venait jusqu'ici de la colonne d'origine — `file_key` pour
 * une clé, `document_recto_url` pour une URL. Une fois les colonnes vidées, cette provenance est
 * perdue : sans ce drapeau, la lecture signerait une URL.
 *
 * Colonne **transitoire** : elle disparaît quand la conversion aura basculé toutes les valeurs en
 * clés, avec la fermeture des accès publics.
 *
 * Additif : `false` par défaut, donc toute pièce existante reste une clé.
 */
export default class extends BaseSchema {
  protected tableName = 'document_pieces'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_public_url').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_public_url')
    })
  }
}
