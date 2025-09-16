import ServiceFee from '#models/service_fee'

export const calculateFee = async (
  amount: number,
  service: string,
  operation: 'add' | 'subtract'
) => {
  const serviceFee = await ServiceFee.query().where('services_type', service).first()
  let total = 0
  if (!serviceFee) {
    throw new Error(`Frais non définis pour le service: ${service}`)
  }
  console.log(serviceFee)

  const fees =
    Number(amount) >= serviceFee.min_amount
      ? (Number(serviceFee.percentage_fee) / 100) * Number(amount)
      : serviceFee.fixed_fee

  if (operation === 'subtract') {
    total = Number(amount) - Number(fees)
  } else {
    total = Number(amount) + Number(fees)
  }

  console.log(`fees ${operation}; fees : ${fees}; total : ${total}`)

  return {
    amount,
    total,
    fees,
  }
}
