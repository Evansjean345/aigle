import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * M4 (B6 — réconciliation, L2-D29). Rend un paiement **interrogeable** auprès de son opérateur :
 *
 * - `provider_reference` : l'identifiant côté provider (retourné à l'initiation), nécessaire pour
 *   poller le statut d'un mouvement resté PENDING (webhook jamais reçu).
 * - `aggregator` : **qui** interroger (`PaymentProviderPort.providerName` — `hub2`, `wave`, …).
 *   Sans lui le poll n'est pas routable : plusieurs adapters coexistent déjà.
 *
 * Porté par `payments` (et non `transactions`) car une transaction peut avoir **plusieurs**
 * paiements — l'inter-réseau a 2 jambes, donc 2 références provider distinctes.
 *
 * Colonnes **nullables** : les paiements existants n'ont pas ces données (réconciliation les ignore),
 * et un provider peut ne pas renvoyer de référence.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('provider_reference').nullable().index()
      table.string('aggregator').nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('provider_reference')
      table.dropColumn('aggregator')
    })
  }
}
