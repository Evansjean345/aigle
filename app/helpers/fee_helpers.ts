import ServiceFee from '#models/service_fee'
import { Exception } from '@adonisjs/core/exceptions'

export const calculateFee = async (
  amount: number,
  service: string,
  operation: 'add' | 'subtract'
) => {
  const serviceFee = await ServiceFee.query().where('services_type', service).first()

  if (!serviceFee) {
    throw new Exception(`Frais non définis pour le service: ${service}`)
  }

  const amt = Number(amount)
  const percentPart = (Number(serviceFee.percentage_fee || 0) / 100) * amt
  const fixedPart = Number(serviceFee.fixed_fee || 0)
  const thresholdOk = amt >= Number(serviceFee.min_amount || 0)

  const feesRaw = thresholdOk ? percentPart : fixedPart
  const totalRaw = operation === 'subtract' ? amt - feesRaw : amt + feesRaw

  let fees = Math.floor(Number(feesRaw))
  let total = Math.floor(Number(totalRaw))

  // Business rule: if computed fees are 0, force fees to 1 and deduct from amount
  if (fees === 0) {
    fees = 1
    total = Math.floor(amt - 1)
  }

  return {
    amount: amt,
    total,
    fees,
  }
}
