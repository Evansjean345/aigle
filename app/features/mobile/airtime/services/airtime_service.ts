import { inject } from '@adonisjs/core'
import ServiceProviderMethod from '#shared/models/service_provider_method'
import ServiceType from '#shared/models/service_type'
import Provider from '#shared/models/provider'
import { Exception } from '@adonisjs/core/exceptions'
import { AirtimeOptionsResult } from '#mobile/airtime/dtos/airtime_options.result'
import { QuoteAirtimeRequestDto } from '#mobile/airtime/dtos/quote_airtime.request'
import { QuoteAirtimeResultDto } from '#mobile/airtime/dtos/quote_airtime.result'

@inject()
export default class MobileAirtimeService {
  async getOptionsByServiceType(serviceTypeCode: string): Promise<AirtimeOptionsResult> {
    const st = await ServiceType.query().where('code', serviceTypeCode).first()
    if (!st) {
      throw new Exception('service type not found', { status: 404, code: 'SERVICE_TYPE_NOT_FOUND' })
    }

    const spms = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .andWhere('is_active', true)
      .preload('paymentMethod')
      .preload('providerFrom')

    const grouped: AirtimeOptionsResult['methods'] = []
    const byMethod: Record<string, AirtimeOptionsResult['methods'][number]> = {}

    for (const spm of spms) {
      const pm = spm.paymentMethod
      const providerFrom = spm.providerFrom
      if (!pm || !providerFrom) continue

      if (!byMethod[pm.code]) {
        byMethod[pm.code] = {
          id: pm.id,
          code: pm.code,
          name: (pm as any).label ?? pm.code,
          order: pm.order,
          providers: [],
        }
      }

      const fromCode = (providerFrom as any).code
      const exists = byMethod[pm.code].providers.find((p) => p.code === fromCode)
      if (exists) continue

      byMethod[pm.code].providers.push({
        id: providerFrom.id,
        code: fromCode,
        name: (providerFrom as any).name ?? fromCode,
        logo: (providerFrom as any).logo ?? undefined,
        feeFixed: Number(spm.feeFixed ?? 0),
        feePercent: Number(spm.feePercent ?? 0),
        currency: spm.currency ?? undefined,
        minAmount: spm.minAmount ?? undefined,
        maxAmount: (spm as any).maxAmount ?? undefined,
        applyFees: spm.applyFees ?? undefined,
      })
    }

    for (const k of Object.keys(byMethod)) grouped.push(byMethod[k])

    return {
      serviceType: st.code,
      methods: grouped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }
  }

  async getToOptionsByServiceType(serviceTypeCode: string, fromProviderCode: string) {
    const st = await ServiceType.query().where('code', serviceTypeCode).first()
    if (!st) {
      throw new Exception('service type not found', { status: 404, code: 'SERVICE_TYPE_NOT_FOUND' })
    }

    const fromProvider = await Provider.query().where('code', fromProviderCode).first()
    if (!fromProvider) {
      throw new Exception('from provider not found', { status: 404, code: 'FROM_PROVIDER_NOT_FOUND' })
    }

    const spms = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .andWhere('is_active', true)
      .andWhere('provider_from_id', fromProvider.id)
      .preload('paymentMethod')
      .preload('providerTo')

    const grouped: Record<
      string,
      {
        id: number
        code: string
        name: string
        providers: {
          id: number
          code: string
          name: string
          logo?: string
          feeFixed: number
          feePercent: number
          currency?: string
          isInterNetwork?: boolean
          fromProviderCode?: string
          fromProviderName?: string
          fromProviderId?: number
        }[]
      }
    > = {}

    for (const spm of spms) {
      const pm = spm.paymentMethod
      const providerTo = spm.providerTo
      if (!pm || !providerTo) continue

      const key = pm.code
      if (!grouped[key]) {
        grouped[key] = {
          id: pm.id,
          code: pm.code,
          name: (pm as any).label ?? pm.code,
          providers: [],
        }
      }

      const toCode = (providerTo as any).code
      const exists = grouped[key].providers.find((p) => p.code === toCode)
      if (exists) continue

      grouped[key].providers.push({
        id: providerTo.id,
        code: toCode,
        name: (providerTo as any).name ?? toCode,
        logo: (providerTo as any).logo ?? undefined,
        feeFixed: Number(spm.feeFixed ?? 0),
        feePercent: Number(spm.feePercent ?? 0),
        currency: spm.currency ?? undefined,
        isInterNetwork: true,
        fromProviderCode: (fromProvider as any).code,
        fromProviderName: (fromProvider as any).name ?? (fromProvider as any).code,
        fromProviderId: fromProvider.id,
      })
    }

    return {
      serviceType: st.code,
      methods: Object.values(grouped),
    }
  }

  quoteFromSpm(spm: ServiceProviderMethod, req: QuoteAirtimeRequestDto): QuoteAirtimeResultDto {
    const feeFixed = Number(spm.feeFixed ?? 0)
    const feePercent = Number(spm.feePercent ?? 0)
    const feeAmount = feeFixed + (req.amount * feePercent) / 100
    return {
      amount: req.amount,
      currency: req.currency ?? spm.currency ?? undefined,
      feeFixed,
      feePercent,
      feeAmount,
      total: req.amount + feeAmount,
      fromProviderCode: req.fromProviderCode,
      toProviderCode: req.toProviderCode,
    }
  }

  async getSpmForQuote(req: QuoteAirtimeRequestDto): Promise<ServiceProviderMethod> {
    const st = await ServiceType.query().where('code', req.serviceType).first()
    if (!st) throw new Exception('service type not found', { status: 404, code: 'SERVICE_TYPE_NOT_FOUND' })

    const from = await Provider.query().where('code', req.fromProviderCode).first()
    const to = await Provider.query().where('code', req.toProviderCode).first()
    if (!from || !to) throw new Exception('provider not found', { status: 404, code: 'PROVIDER_NOT_FOUND' })

    const spm = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .andWhere('provider_from_id', from.id)
      .andWhere('provider_to_id', to.id)
      .andWhere('is_active', true)
      .first()

    if (!spm) {
      throw new Exception('No route for providers', { status: 404, code: 'ROUTE_NOT_FOUND' })
    }

    return spm
  }
}
