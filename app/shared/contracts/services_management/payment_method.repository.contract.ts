import PaymentMethod from '#shared/models/payment_method'

export interface ListPaymentMethodsParams {
  page?: number
  limit?: number
  q?: string
}

export interface PaymentMethodRepositoryContract {
  paginate(params: ListPaymentMethodsParams): Promise<any>
  findByIdOrFail(id: number): Promise<PaymentMethod>
  create(data: { code: string; label: string }): Promise<PaymentMethod>
  update(id: number, data: Partial<{ code: string; label: string }>): Promise<PaymentMethod>
  delete(id: number): Promise<void>
}
