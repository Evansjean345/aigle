import { FeeContext, FeeRule } from './fee_types.js'

export interface FeeCalculationResult {
  amount: number
  fees: number
  total: number
}

/**
 * Calculates the fee based on the provided fee rule and context.
 * Ensures fees and total are numeric and rounded down (floor) as required.
 *
 * @param {FeeContext} ctx - The context containing the amount and operation type.
 * @param {FeeRule} rule - The rule defining the fee calculation, including percentage and fixed amounts.
 * @return {FeeCalculationResult} The result of the fee calculation, including the original amount, calculated fees, and total amount after applying the fees.
 */
export function calculateFeeFromRule(ctx: FeeContext, rule: FeeRule): FeeCalculationResult {
  const amount = Number(ctx.amount)
  const percentPart = (Number(rule.feePercent || 0) / 100) * amount
  const fixedPart = Number(rule.feeFixed || 0)

  let fees = Math.floor(percentPart + fixedPart)

  if (fees === 0) {
    fees = 1
  }

  const total = ctx.operation === 'subtract' ? amount - fees : amount + fees
  return { amount, fees, total }
}
