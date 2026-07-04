import { inject } from '@adonisjs/core'
import {
  PaymentMethodCreateDto,
  PaymentMethodUpdateDto,
} from '#core/catalogs/application/dtos/payment_methods.dto'
import PaymentMethodRepository, {
  ListPaymentMethodsParams,
} from '#core/catalogs/domain/interfaces/payment_method_repository'

@inject()
export default class PaymentMethodsUseCase {
  constructor(private readonly repository: PaymentMethodRepository) {}

  list(params: ListPaymentMethodsParams) {
    return this.repository.paginate(params)
  }

  get(id: number) {
    return this.repository.findByIdOrFail(id)
  }

  create(payload: PaymentMethodCreateDto) {
    if (!payload.code || !payload.label) {
      throw new Error('code and label are required')
    }
    return this.repository.create({ code: payload.code, label: payload.label })
  }

  update(id: number, payload: PaymentMethodUpdateDto) {
    return this.repository.update(id, payload)
  }

  delete(id: number) {
    return this.repository.delete(id)
  }
}
