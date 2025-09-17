import { inject } from '@adonisjs/core'
import PaymentMethodsService from '../services/payment_methods.service.js'
import { ListPaymentMethodsParams } from '#shared/interfaces/services_management/index.js'
import { PaymentMethodCreateDto, PaymentMethodUpdateDto } from '#admin/services_management/dtos/payment_methods.dto.js'

@inject()
export default class PaymentMethodsUseCase {
  constructor(private readonly service: PaymentMethodsService) {}

  list(params: ListPaymentMethodsParams) {
    return this.service.list(params)
  }

  get(id: number) {
    return this.service.get(id)
  }

  create(payload: PaymentMethodCreateDto) {
    return this.service.create(payload)
  }

  update(id: number, payload: PaymentMethodUpdateDto) {
    return this.service.update(id, payload)
  }

  delete(id: number) {
    return this.service.delete(id)
  }
}
