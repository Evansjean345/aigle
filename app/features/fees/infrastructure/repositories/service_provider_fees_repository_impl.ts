import ServiceProviderMethod from '#features/catalogs/domain/models/service_provider_method'
import { FeeRule } from '#features/fees/domain/fee_types'
import ServiceProviderFeesRepository, {
  SpmRuleLookup,
} from '#features/fees/domain/interfaces/service_provider_fees_repository'

/**
 * ServiceProviderFeesRepositoryImpl is an implementation of the ServiceProviderFeesRepository interface
 * responsible for querying and retrieving fee rules for service provider transactions based on
 * various parameters such as service type, payment method, providers, and currency.
 */
export class ServiceProviderFeesRepositoryImpl implements ServiceProviderFeesRepository {
  /**
   * Finds and retrieves a fee rule based on the given parameters.
   *
   * @param {Object} params - The lookup parameters for finding the rule.
   * @param {string} params.serviceTypeId - The ID of the service type.
   * @param {string} params.paymentMethodId - The ID of the payment method.
   * @param {string} params.providerFromId - The ID of the originating provider.
   * @param {string} [params.providerToId] - The ID of the destination provider. Pass `undefined` if not applicable or `null` to filter for null values.
   * @param {string} [params.currency] - The currency code to filter the rule. Optional.
   * @param {boolean} [params.onlyActive=true] - Whether to only include active rules. Default is true.
   *
   * @return {Promise<FeeRule | null>} A promise that resolves to the found fee rule or null if no matching rule is found.
   */
  async findRule({
    serviceTypeId,
    paymentMethodId,
    providerFromId,
    providerToId,
    currency,
    onlyActive = true,
  }: SpmRuleLookup): Promise<FeeRule | null> {
    const query = ServiceProviderMethod.query()
      .where('service_type_id', serviceTypeId)
      .andWhere('payment_method_id', paymentMethodId)
      .andWhere('provider_from_id', providerFromId)

    if (providerToId !== undefined) {
      if (providerToId === null) {
        query.andWhereNull('provider_to_id')
      } else {
        query.andWhere('provider_to_id', providerToId)
      }
    }

    if (currency) {
      query.andWhere('currency', currency)
    }

    if (onlyActive) {
      query.andWhere('is_active', true)
    }

    query.orderByRaw('CASE WHEN provider_to_id IS NULL THEN 1 ELSE 0 END')
    query.orderBy('id', 'desc')

    const row = await query.first()

    if (!row) return null

    return {
      feeFixed: Number(row.feeFixed ?? 0),
      feePercent: Number(row.feePercent ?? 0),
      currency: row.currency,
    }
  }
}
