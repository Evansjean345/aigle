import PaymentMethod from '#shared/models/payment_method'

export interface ListPaymentMethodsParams {
  page?: number
  limit?: number
  q?: string
}

export default abstract class PaymentMethodRepository {
  abstract paginate(params: ListPaymentMethodsParams): Promise<any>
  abstract findByIdOrFail(id: number): Promise<PaymentMethod>
  abstract create(data: { code: string; label: string }): Promise<PaymentMethod>
  abstract update(
    id: number,
    data: Partial<{ code: string; label: string }>
  ): Promise<PaymentMethod>
  abstract delete(id: number): Promise<void>
}
