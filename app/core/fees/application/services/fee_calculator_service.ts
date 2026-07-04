import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { FeeContext, FeeRule } from '#core/fees/domain/fee_types'
import { ServiceProviderFeesRepositoryImpl } from '#core/fees/infrastructure/repositories/service_provider_fees_repository_impl'

export interface FeeCalculationResult {
  amount: number
  fees: number
  total: number
}

/**
 * FeeCalculator class for calculating fees based on fee rules and context.
 * Ensures fees and total are numeric and rounded down (floor) as required.
 */
@inject()
export default class FeeCalculatorService {
  constructor(private readonly feesRepo: ServiceProviderFeesRepositoryImpl) {}

  /**
   * Calculates the fee based on the provided fee rule and context.
   *
   * @param {FeeContext} ctx - The context containing the amount and operation type.
   * @param {FeeRule} rule - The rule defining the fee calculation, including percentage and fixed amounts.
   * @return {FeeCalculationResult} The result of the fee calculation, including the original amount, calculated fees, and total amount after applying the fees.
   */
  calculate(ctx: FeeContext, rule: FeeRule): FeeCalculationResult {
    const amount = Number(ctx.amount)
    const feePercent = Number(rule.feePercent || 0) / 100
    const feeFixed = Number(rule.feeFixed || 0)

    if (ctx.include_fees) {
      const amountToSend = Number(ctx.amount)
      const fees = Math.floor(amountToSend * feePercent + feeFixed)
      const amountToDebite = amountToSend + fees

      return { amount: amountToDebite, fees, total: amountToSend }
    } else {
      const fees = Math.floor(amount * feePercent + feeFixed)
      const total = ctx.operation === 'subtract' ? amount - fees : amount + fees

      return { amount, fees, total }
    }
  }

  /**
   * Calculates fees for a given service context.
   *
   * @param params Parameters for fee rule lookup.
   * @param calculationContext Context for the actual calculation.
   * @returns Calculated fees, total, and amount.
   * @throws {Exception} If no fee rule is found.
   */
  async calculateForService(
    params: {
      serviceTypeId: number
      paymentMethodId: number
      providerFromId: number
      providerToId?: number
      currency?: string
    },
    calculationContext: {
      amount: number
      operation: 'subtract' | 'add'
      include_fees?: boolean
    }
  ): Promise<FeeCalculationResult> {
    const rule = await this.feesRepo.findRule({
      ...params,
      onlyActive: true,
    })

    if (!rule) {
      throw new Exception('Aucune règle de frais trouvée pour ce contexte', {
        status: 404,
        code: 'NO_RULE_FOUND',
      })
    }

    return this.calculate(calculationContext, rule)
  }
}
