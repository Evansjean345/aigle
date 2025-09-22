import { inject } from '@adonisjs/core'
import PaymentMethodRepository from '#shared/repositories/payment_method_repository_impl'
import {
  PaymentMethodCreateDto,
  PaymentMethodUpdateDto,
} from '#admin/services_management/dtos/payment_methods.dto'
import { ListPaymentMethodsParams } from '#shared/interfaces/services_management/payment_method_repository'

@inject()
export default class PaymentMethodsService {
  constructor(private readonly repo: PaymentMethodRepository) {}

  list(params: ListPaymentMethodsParams) {
    return this.repo.paginate(params)
  }

  get(id: number) {
    return this.repo.findByIdOrFail(id)
  }

  async create(data: PaymentMethodCreateDto) {
    if (!data.code || !data.label) {
      throw new Error('code and label are required')
    }
    return this.repo.create({ code: data.code, label: data.label })
  }

  update(id: number, data: PaymentMethodUpdateDto) {
    return this.repo.update(id, data)
  }

  delete(id: number) {
    return this.repo.delete(id)
  }
}
