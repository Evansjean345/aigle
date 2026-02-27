import { DepositValidator } from '#features/operations/presentation/mobile/validators/deposit_validator'
import { DepositRequestDto } from '#features/operations/application/dto/deposit.dto'

export const toDepositDto = (payload: DepositValidator): DepositRequestDto => ({
  amount: payload.amount,
  serviceType: payload.service_type,
  providerCode: payload.provider_code,
  providerId: payload.provider_id,
  paymentMethodCode: payload.payment_method_code,
  paymentMethodId: payload.payment_method_id,
  phone: payload.phone,
  pinCode: payload.pincode,
})
