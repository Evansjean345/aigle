import { type FeeRule } from '#shared/domain/fees/fee_types'

export interface SpmRuleLookup {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number | null
  currency?: string
  onlyActive?: boolean
}

/**
 * This abstract class serves as a repository for operations related to service provider fees.
 * It defines the contract for interacting with fee rules associated with service providers.
 */
export default abstract class ServiceProviderFeesRepository {
  /**
   * Finds and retrieves a fee rule based on the provided lookup parameters.
   *
   * @param {SpmRuleLookup} params - The criteria used to locate the desired rule.
   * @return {Promise<FeeRule | null>} A promise that resolves to the matching fee rule if found, or null if no rule matches.
   */
  abstract findRule(params: SpmRuleLookup): Promise<FeeRule | null>
}
