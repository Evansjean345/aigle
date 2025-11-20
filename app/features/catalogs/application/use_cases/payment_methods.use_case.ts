import { inject } from '@adonisjs/core'
import PaymentMethodsService from '#features/catalogs/application/services/payment_methods.service'
import {
  PaymentMethodCreateDto,
  PaymentMethodUpdateDto,
} from '#features/catalogs/application/dtos/payment_methods.dto'

import { ListPaymentMethodsParams } from '#features/catalogs/domain/interfaces/payment_method_repository'

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
