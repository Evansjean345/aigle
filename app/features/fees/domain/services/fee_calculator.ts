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
  const feePercent = Number(rule.feePercent || 0) / 100
  const feeFixed = Number(rule.feeFixed || 0)

  if (ctx.include_fees) {
    const amountToSend = Number(ctx.amount)
    const fees = Math.floor(amountToSend * feePercent + feeFixed)
    const amountTodebite = amountToSend + fees

    return { amount: amountTodebite, fees, total: amountToSend }
  } else {

    const fees = Math.floor(amount * feePercent + feeFixed)
    const total = ctx.operation === 'subtract' ? amount - fees : amount + fees

    console.log('debugging in not include fees')
    console.log(fees, amount, total)
    return { amount, fees, total }
  }
}
