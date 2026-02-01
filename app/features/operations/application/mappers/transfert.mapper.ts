import { TransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_validator'
import { TransfertRequestDto } from '#features/operations/application/dto/transfert.dto'

/**
 * Converts a `TransfertValidator` payload object into a `TransfertRequestDto`.
 *
 * @param {TransfertValidator} payload - The input payload containing data to be transformed.
 * @returns {TransfertRequestDto} An object containing the transformed data from the payload.
 */
export const toTransfertDto = (payload: TransfertValidator): TransfertRequestDto => ({
  amount: payload.amount,
  serviceType: payload.service_type,
  providerCode: payload.provider_code,
  providerId: payload.provider_id,
  paymentMethodCode: payload.payment_method_code,
  paymentMethodId: payload.payment_method_id,
  phone: payload.phone,
  include_fees: payload.include_fees,
  pinCode: payload.pincode,
})
