import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#shared/repositories/services_management/service_provider_method.repository.js'
import { ListSpmParams } from '#shared/interfaces/services_management/index.js'
import ServiceType from '#shared/models/service_type'
import PaymentMethod from '#shared/models/payment_method'
import Provider from '#shared/models/provider'
import {
  ServiceProviderMethodCreateDto,
  ServiceProviderMethodUpdateDto,
} from '#admin/services_management/dtos/service_provider_methods.dto.js'

@inject()
export default class ServiceProviderMethodsService {
  constructor(private readonly repo: ServiceProviderMethodRepository) {}

  list(params: ListSpmParams) {
    return this.repo.paginate(params)
  }

  get(id: number) {
    return this.repo.findByIdWithRelationsOrFail(id)
  }

  async create(data: ServiceProviderMethodCreateDto) {
    // Basic validation
    for (const key of ['serviceTypeId', 'paymentMethodId', 'providerFromId'] as const) {
      if (!data[key]) {
        throw new Error(`${key} is required`)
      }
    }

    // Verify foreign keys for clearer error feedback
    const [st, pm, pf, pt] = await Promise.all([
      ServiceType.find(data.serviceTypeId!),
      PaymentMethod.find(data.paymentMethodId!),
      Provider.find(data.providerFromId!),
      data.providerToId ? Provider.find(data.providerToId) : Promise.resolve(null),
    ])

    if (!st) throw new Error('Invalid serviceTypeId')
    if (!pm) throw new Error('Invalid paymentMethodId')
    if (!pf) throw new Error('Invalid providerFromId')
    if (data.providerToId && !pt) throw new Error('Invalid providerToId')

    return this.repo.create(data as any)
  }

  update(id: number, data: ServiceProviderMethodUpdateDto) {
    return this.repo.update(id, data)
  }

  delete(id: number) {
    return this.repo.delete(id)
  }
}
