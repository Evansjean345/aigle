import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Unifie le vocabulaire du portefeuille sur « geler / dégeler », des deux côtés.
 *
 * Un portefeuille se gèle, un compte se bloque : réserver `block` aux comptes et aux organisations
 * lève l'ambiguïté d'un back-office où les deux droits se composent dans le même écran. Les
 * libellés disaient déjà « Geler » ; seuls les slugs disaient autre chose.
 *
 * Les affectations aux rôles ne sont pas touchées : `role_permission` référence un identifiant, pas
 * un slug.
 */
const RENAMES: Array<[string, string]> = [
  ['users.wallets.block', 'users.wallets.freeze'],
  ['users.wallets.activate', 'users.wallets.unfreeze'],
]

export default class extends BaseSchema {
  async up() {
    for (const [from, to] of RENAMES) {
      await this.db.from('permissions').where('slug', from).update({ slug: to })
    }
  }

  async down() {
    for (const [from, to] of [...RENAMES].reverse()) {
      await this.db.from('permissions').where('slug', to).update({ slug: from })
    }
  }
}
