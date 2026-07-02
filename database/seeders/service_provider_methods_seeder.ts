import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ServiceProviderMethod from '#shared/models/service_provider_method'
import ServiceType from '#shared/models/service_type'
import PaymentMethod from '#shared/models/payment_method'
import Provider from '#shared/models/provider'

export default class extends BaseSeeder {
  public async run() {
    // Resolve base references by code
    const [deposit, transfert, interReseau, topup] = await Promise.all([
      ServiceType.findBy('code', 'deposit'),
      ServiceType.findBy('code', 'transfert'),
      ServiceType.findBy('code', 'inter_reseau'),
      ServiceType.findBy('code', 'topup'),
    ])

    const mobileMoney = await PaymentMethod.findBy('code', 'mobile-money')

    const providers = await Provider.query().whereIn('code', ['orange', 'moov', 'wave', 'mtn'])
    const providerByCode = Object.fromEntries(providers.map((p) => [p.code, p])) as Record<
      string,
      Provider
    >

    if (
      !deposit ||
      !transfert ||
      !interReseau ||
      !topup ||
      !mobileMoney ||
      providers.length === 0
    ) {
      console.warn(
        '[service_provider_methods_seeder] Required base data missing. Please seed service_types, payment_methods and providers first.'
      )
      return
    }

    const defaults = {
      feeFixed: 0,
      feePercent: 0,
      currency: 'XOF',
      isActive: true,
    }

    const records: Array<
      {
        serviceTypeId: number
        paymentMethodId: number
        providerFromId: number
        providerToId: number | null
      } & typeof defaults
    > = []

    // deposit and transfert: per provider, no provider_to (null)
    for (const code of ['orange', 'moov', 'wave', 'mtn']) {
      const p = providerByCode[code]
      if (!p) continue
      records.push({
        serviceTypeId: deposit.id,
        paymentMethodId: mobileMoney.id,
        providerFromId: p.id,
        providerToId: null,
        ...defaults,
      })
      records.push({
        serviceTypeId: transfert.id,
        paymentMethodId: mobileMoney.id,
        providerFromId: p.id,
        providerToId: null,
        ...defaults,
      })
      // topup: from provider to same provider
      records.push({
        serviceTypeId: topup.id,
        paymentMethodId: mobileMoney.id,
        providerFromId: p.id,
        providerToId: p.id,
        ...defaults,
      })
    }

    const providerCodes = ['orange', 'moov', 'wave', 'mtn'].filter((c) => !!providerByCode[c])

    for (const from of providerCodes) {
      for (const to of providerCodes) {
        if (from === to) continue // inter-réseau exclut intra-opérateur
        const pf = providerByCode[from]
        const pt = providerByCode[to]

        records.push({
          serviceTypeId: interReseau.id,
          paymentMethodId: mobileMoney.id,
          providerFromId: pf.id,
          providerToId: pt.id,
          ...defaults,
        })
      }
    }

    // Upsert using composite unique keys
    for (const r of records) {
      await ServiceProviderMethod.updateOrCreate(
        {
          serviceTypeId: r.serviceTypeId,
          paymentMethodId: r.paymentMethodId,
          providerFromId: r.providerFromId,
          providerToId: r.providerToId,
        },
        r
      )
    }
  }
}
