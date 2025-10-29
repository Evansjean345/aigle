import PaymentMethod from '#shared/models/payment_method'
import { PaymentMethodCreateDto, PaymentMethodUpdateDto } from '#admin/services_management/dtos/payment_methods.dto'
import { PaymentMethodResponseDto } from '#admin/services_management/dtos/payment_methods.response.dto'

export const toPaymentMethodCreateDto = (input: any): PaymentMethodCreateDto => ({
  code: String(input.code ?? ''),
  label: String(input.label ?? ''),
})

export const toPaymentMethodUpdateDto = (input: any): PaymentMethodUpdateDto => ({
  code: input.code,
  label: input.label,
})

export const toPaymentMethodResponse = (item: PaymentMethod): PaymentMethodResponseDto => ({
  id: item.id,
  code: item.code,
  label: item.label,
  createdAt: (item as any).createdAt,
  updatedAt: (item as any).updatedAt,
})
