import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ServiceProviderMethod from '#core/catalog/catalogs/domain/models/service_provider_method'
import ServiceType from '#core/catalog/catalogs/domain/models/service_type'
import PaymentMethod from '#core/catalog/catalogs/domain/models/payment_method'
import Provider from '#core/catalog/catalogs/domain/models/provider'
import ServiceTypesSeeder from '#database/seeders/service_types_seeder'
import PaymentMethodsSeeder from '#database/seeders/payment_methods_seeder'
import ProvidersSeeder from '#database/seeders/providers_seeder'

/** Opérateurs de monnaie électronique, entre lesquels le transfert inter-réseaux circule. */
const MOBILE_MONEY = ['orange', 'moov', 'wave', 'mtn']

/** Une règle de frais : ce qu'elle couvre, et ce qu'elle prélève. */
interface FeeRule {
  service: string
  method: string
  from: string
  to?: string
  percent: number
  minAmount: number
}

/**
 * Règles de frais, telles qu'elles sont appliquées.
 *
 * Aucun frais fixe aujourd'hui : tout est proportionnel. Le montant plancher varie selon
 * l'opérateur — Orange et Wave acceptent des dépôts et transferts de 10 francs, les autres
 * exigent 300.
 */
const RULES: FeeRule[] = [
  // Paiement marchand : 2 % chez les opérateurs, gratuit entre portefeuilles Aigle.
  ...MOBILE_MONEY.map((from) => ({
    service: 'checkout',
    method: 'mobile-money',
    from,
    percent: 2,
    minAmount: 5,
  })),
  { service: 'checkout', method: 'wallet', from: 'aigle', percent: 0, minAmount: 5 },

  // Dépôt : 3 %.
  { service: 'deposit', method: 'mobile-money', from: 'orange', percent: 3, minAmount: 10 },
  { service: 'deposit', method: 'mobile-money', from: 'wave', percent: 3, minAmount: 10 },
  { service: 'deposit', method: 'mobile-money', from: 'moov', percent: 3, minAmount: 300 },
  { service: 'deposit', method: 'mobile-money', from: 'mtn', percent: 3, minAmount: 300 },

  // Transfert sortant : 2 %, gratuit entre portefeuilles Aigle.
  { service: 'transfert', method: 'mobile-money', from: 'orange', percent: 2, minAmount: 10 },
  { service: 'transfert', method: 'mobile-money', from: 'wave', percent: 2, minAmount: 300 },
  { service: 'transfert', method: 'mobile-money', from: 'moov', percent: 2, minAmount: 300 },
  { service: 'transfert', method: 'mobile-money', from: 'mtn', percent: 2, minAmount: 300 },
  { service: 'transfert', method: 'wallet', from: 'aigle', percent: 0, minAmount: 10 },

  // Inter-réseaux : 4 %, y compris d'un opérateur vers lui-même.
  ...MOBILE_MONEY.flatMap((from) =>
    MOBILE_MONEY.map((to) => ({
      service: 'inter_reseau',
      method: 'mobile-money',
      from,
      to,
      percent: 4,
      minAmount: 300,
    }))
  ),
]

/**
 * Règles de frais par couple service / moyen de paiement / opérateur.
 *
 * Sans elles, aucun mouvement ne trouve son tarif et toute opération est refusée.
 */
export default class extends BaseSeeder {
  async run() {
    // Les seeders passent dans l'ordre alphabétique, qui place celui-ci avant `service_types` :
    // ses références sont donc posées ici plutôt qu'attendues.
    await new ServiceTypesSeeder(this.client).run()
    await new PaymentMethodsSeeder(this.client).run()
    await new ProvidersSeeder(this.client).run()

    const [services, methods, providers] = await Promise.all([
      ServiceType.all(),
      PaymentMethod.all(),
      Provider.all(),
    ])

    const serviceByCode = new Map(services.map((service) => [service.code, service.id]))
    const methodByCode = new Map(methods.map((method) => [method.code, method.id]))
    const providerByCode = new Map(providers.map((provider) => [provider.code, provider.id]))

    const missing = RULES.filter(
      (rule) =>
        !serviceByCode.has(rule.service) ||
        !methodByCode.has(rule.method) ||
        !providerByCode.has(rule.from) ||
        (rule.to !== undefined && !providerByCode.has(rule.to))
    )

    if (missing.length > 0) {
      throw new Error(
        `${missing.length} règle(s) sans référence : seeder d'abord service_types, payment_methods et providers.`
      )
    }

    for (const rule of RULES) {
      await ServiceProviderMethod.updateOrCreate(
        {
          serviceTypeId: serviceByCode.get(rule.service),
          paymentMethodId: methodByCode.get(rule.method),
          providerFromId: providerByCode.get(rule.from),
          providerToId: rule.to ? providerByCode.get(rule.to) : null,
        },
        {
          feeFixed: 0,
          feePercent: rule.percent,
          minAmount: rule.minAmount,
          applyFeeds: true,
          currency: 'XOF',
          isActive: true,
        }
      )
    }
  }
}
