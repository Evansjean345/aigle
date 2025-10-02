import { inject } from '@adonisjs/core'
import ServiceProviderMethod from '#shared/models/service_provider_method'
import ServiceType from '#shared/models/service_type'
import { PaymentOptionsByServiceTypeResult } from '#mobile/services/dtos/payment_options_by_service_type.result'
import { Exception } from '@adonisjs/core/exceptions'
import Provider from '#shared/models/provider'

/**
 * MobileServicesService class provides functionality to retrieve payment options
 * associated with a given service type.
 */
@inject()
export default class MobileServicesService {
  /**
   * Retrieves payment options available for a given service type code.
   *
   * @param {string} serviceTypeCode - The code representing the type of service for which payment options are to be retrieved.
   * @return {Promise<PaymentOptionsByServiceTypeResult>} An object containing the service type code and available payment methods,
   * each categorized by payment method code with associated providers and their fees.
   */
  async getPaymentOptionsByServiceType(
    serviceTypeCode: string
  ): Promise<PaymentOptionsByServiceTypeResult> {
    const st = await ServiceType.query().where('code', serviceTypeCode).first()

    if (!st) {
      throw new Exception('service type not found', {
        status: 404,
        code: 'SERVICE_TYPE_NOT_FOUND',
      })
    }

    const spms = await ServiceProviderMethod.query()
      .where('service_type_id', st.id)
      .andWhere('is_active', true)
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
          logo?: string
          feeFixed: number
          feePercent: number
          currency?: string
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
      // For page 1: only list unique origin providers per method (no destination info)

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
        })
      }
    }

    return {
      serviceType: st.code,
      methods: Object.values(grouped).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }
  }

  /**
   * Retrieves destination providers (to) available for a given service type and origin provider code.
   * Returns payment methods with their destination providers only (inter-network), suitable for page 2.
   */
  async getToPaymentOptionsByServiceType(
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
      .andWhere('is_active', true)
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
          fromProviderCode: fromCode,
          fromProviderName: fromName,
          fromProviderId: fromProvider.id,
        })
      }
    }

    return {
      serviceType: st.code,
      methods: Object.values(grouped),
    }
  }
}
