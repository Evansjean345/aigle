import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Un dossier de vérification peut désormais être **en cours de constitution**.
 *
 * Une entreprise n'a pas toujours son DFE le jour où elle obtient son RCCM : son dossier reste
 * `in_submission` tant qu'une pièce requise manque, et ne passe en `pending` — donc dans la file de
 * revue — qu'une fois complet.
 *
 * `KycDocumentStatus.IN_SUBMISSION` était déclaré en code depuis l'origine sans que l'enum de la
 * base l'accepte : toute écriture aurait échoué, ou été tronquée selon le `sql_mode`.
 *
 * `kyc_attemps` n'est pas touchée : une tentative enregistre une soumission ou une décision, jamais
 * un état d'attente.
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('status', ['in_submission', 'pending', 'approved', 'rejected']).nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('status', ['pending', 'approved', 'rejected']).nullable().alter()
    })
  }
}
