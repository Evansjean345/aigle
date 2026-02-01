export interface PaymentResponseDTO {
  paymentMethod: string
  paymentDetails: {
    operator: string
    phone: string,
    user: string
  }
}
