import { InterTransfertRequestDto } from '#mobile/operations/dto/transfert_inter.dto'
import { InterTransfertValidator } from '#mobile/operations/validators/transfert_inter_validator'

export const toInterTransfertDto = (
  payload: InterTransfertValidator
): InterTransfertRequestDto => ({
  amount: payload.amount,
  serviceType: payload.service_type,
  providerFromId: payload.provider_from_id,
  providerFromCode: payload.provider_from_code,
  debiteurPhone: payload.debiteur_phone,
  paymentMethodDepositCode: payload.payment_method_deposit_code,
  paymentMethodDepositId: payload.payment_method_deposit_id,
  pinCode: payload.pin_code,
  providerToId: payload.provider_to_id,
  providerToCode: payload.provider_to_code,
  beneficiairePhone: payload.beneficiaire_phone,
  paymentMethodTransfertCode: payload.payment_method_transfert_code,
  paymentMethodTransfertId: payload.payment_method_transfert_id,
})
