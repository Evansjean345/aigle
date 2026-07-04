import { inject } from '@adonisjs/core'
import { PaymentOptionsByServiceTypeResult } from '#core/catalogs/application/dtos/payment_options_by_service_type.result'
import ServiceType from '#core/catalogs/domain/models/service_type'
import { Exception } from '@adonisjs/core/exceptions'
import ServiceProviderMethod from '#core/catalogs/domain/models/service_provider_method'

@inject()
/**
 * A use case class responsible for retrieving payment options associated with a specific service type.
 */
export default class GetPaymentOptionsByServiceTypeUseCase {
  /**
   * Executes a request to retrieve payment options for the given service type code.
   *
   * @param {string} serviceTypeCode - The code representing the service type for which payment options are requested.
   * @return {Promise<PaymentOptionsByServiceTypeResult>} A promise that resolves to the result containing payment options for the specified service type.
   */
  async execute(serviceTypeCode: string): Promise<PaymentOptionsByServiceTypeResult> {
    const st = await ServiceType.query().where('code', serviceTypeCode).first()

    if (!st) {
      throw new Exception('service type not found', {
        status: 404,
        code: 'SERVICE_TYPE_NOT_FOUND',
      })
    }

    const spms = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .preload('paymentMethod')
      .preload('providerFrom')

    const grouped: Record<
      string,
      {
        id: number
        code: string
        name: string
        order: number
        providers: {
          id: number
          code: string
          name: string
          isActive: boolean
          logo?: string
          feeFixed: number
          feePercent: number
          currency?: string
          minAmount?: number
          applyFees?: boolean
          toProviderCode?: string
          toProviderName?: string
          isInterNetwork?: boolean
        }[]
      }
    > = {}

    for (const spm of spms) {
      const pm = spm.paymentMethod
      const providerFrom = spm.providerFrom
      if (!pm || !providerFrom) continue

      const key = pm.code

      if (!grouped[key]) {
        grouped[key] = {
          code: pm.code,
          name: (pm as any).label ?? pm.code,
          id: pm.id,
          order: pm.order,
          providers: [],
        }
      }

      const fromCode = (providerFrom as any).code
      const fromName = (providerFrom as any).name ?? fromCode

      const exists = grouped[key].providers.find((p: any) => p.code === fromCode)

      if (!exists) {
        grouped[key].providers.push({
          id: providerFrom.id,
          code: fromCode,
          name: fromName,
          logo: (providerFrom as any).logo ?? undefined,
          feeFixed: Number(spm.feeFixed ?? 0),
          feePercent: Number(spm.feePercent ?? 0),
          currency: spm.currency ?? undefined,
          minAmount: spm.minAmount ?? undefined,
          applyFees: spm.applyFeeds,
          isActive: spm.isActive,
        })
      }
    }

    return {
      serviceType: st.code,
      methods: Object.values(grouped).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }
  }
}
