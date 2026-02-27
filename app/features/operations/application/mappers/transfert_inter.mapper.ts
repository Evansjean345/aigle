import { InterTransfertRequestDto } from '#features/operations/application/dto/transfert_inter.dto'
import { InterTransfertValidator } from '#features/operations/presentation/mobile/validators/transfert_inter_validator'

export const toInterTransfertDto = (
  payload: InterTransfertValidator
): InterTransfertRequestDto => ({
  amount: payload.amount,
  serviceType: payload.service_type,
  providerFromId: payload.debitaire.provider_id,
  providerFromCode: payload.debitaire.provider_code,
  debiteurPhone: payload.debitaire.phone,
  paymentMethodDepositCode: payload.debitaire.payment_method_code,
  paymentMethodDepositId: payload.debitaire.payment_method_id,
  pinCode: payload.debitaire.pincode,
  include_fees: payload.include_fees,
  providerToId: payload.beneficiaire.provider_id,
  providerToCode: payload.beneficiaire.provider_code,
  beneficiairePhone: payload.beneficiaire.phone,
  paymentMethodTransfertCode: payload.beneficiaire.payment_method_code,
  paymentMethodTransfertId: payload.beneficiaire.payment_method_id,
})
