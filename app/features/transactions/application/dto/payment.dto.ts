import { PaymentStep } from '#features/transactions/domain/enums/payment_step'

export interface PaymentResponseDTO {
  paymentMethod: string
  status: string
  step: PaymentStep
  paymentDetails: {
    operator: string
    phone: string
    user: string
  }
}
