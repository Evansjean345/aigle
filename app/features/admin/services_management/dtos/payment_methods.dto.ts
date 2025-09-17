export interface PaymentMethodCreateDto {
  code: string
  label: string
}

export type PaymentMethodUpdateDto = Partial<PaymentMethodCreateDto>
