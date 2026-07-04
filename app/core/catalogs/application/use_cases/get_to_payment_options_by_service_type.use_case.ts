import { inject } from '@adonisjs/core'
import { PaymentOptionsByServiceTypeResult } from '#core/catalogs/application/dtos/payment_options_by_service_type.result'
import ServiceType from '#core/catalogs/domain/models/service_type'
import { Exception } from '@adonisjs/core/exceptions'
import Provider from '#core/catalogs/domain/models/provider'
import ServiceProviderMethod from '#core/catalogs/domain/models/service_provider_method'

@inject()
/**
 * Use case for retrieving destination providers for a given service type and origin provider.
 */
export default class GetToPaymentOptionsByServiceTypeUseCase {
  /**
   * Executes the retrieval of payment options based on the provided service type code
   * and provider code.
   *
   * @param {string} serviceTypeCode - The code representing the type of service.
   * @param {string} fromProviderCode - The code representing the originating provider.
   * @return {Promise<PaymentOptionsByServiceTypeResult>} A promise that resolves with
   * the payment options result for the given service type and provider.
   */
  async execute(
    serviceTypeCode: string,
    fromProviderCode: string
  ): Promise<PaymentOptionsByServiceTypeResult> {
    const st = await ServiceType.query().where('code', serviceTypeCode).first()

    if (!st) {
      throw new Exception('service type not found', {
        status: 404,
        code: 'SERVICE_TYPE_NOT_FOUND',
      })
    }

    const fromProvider = await Provider.query().where('code', fromProviderCode).first()

    if (!fromProvider) {
      throw new Exception('from provider not found', {
        status: 404,
        code: 'FROM_PROVIDER_NOT_FOUND',
      })
    }

    const spms = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .andWhere('provider_from_id', fromProvider.id)
      .preload('paymentMethod')
      .preload('providerFrom')
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
          applyFees: boolean
          logo?: string
          feeFixed: number
          feePercent: number
          currency?: string
          isInterNetwork?: boolean
          fromProviderCode?: string
          fromProviderName?: string
          fromProviderId?: number
          isActive: boolean
        }[]
      }
    > = {}

    for (const spm of spms) {
      const pm = spm.paymentMethod
      const providerTo = spm.providerTo

      if (!pm || !providerTo) continue

      const fromCode = (fromProvider as any).code
      const fromName = (fromProvider as any).name ?? fromCode
      const toCode = (providerTo as any).code as string
      const toName = (providerTo as any).name ?? toCode

      const key = pm.code

      if (!grouped[key]) {
        grouped[key] = {
          code: pm.code,
          name: (pm as any).label ?? pm.code,
          id: pm.id,
          providers: [],
        }
      }

      const exists = grouped[key].providers.find((p: any) => p.code === toCode)

      if (!exists) {
        grouped[key].providers.push({
          id: providerTo.id,
          code: toCode,
          name: toName,
          logo: (providerTo as any).logo ?? undefined,
          feeFixed: Number(spm.feeFixed ?? 0),
          feePercent: Number(spm.feePercent ?? 0),
          currency: spm.currency ?? undefined,
          isInterNetwork: true,
          applyFees: spm.applyFeeds,
          fromProviderCode: fromCode,
          fromProviderName: fromName,
          fromProviderId: fromProvider.id,
          isActive: spm.isActive,
        })
      }
    }

    return {
      serviceType: st.code,
      methods: Object.values(grouped),
    }
  }
}
