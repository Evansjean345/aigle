export interface PaymentResponseDTO {
  paymentMethod: string
  currency: string
  paymentDetails: {
    operator: string
    phone: string
  }
}
