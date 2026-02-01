import { inject } from '@adonisjs/core'
import { ServiceProviderMethodCreateDto } from '#features/catalogs/application/dtos/service_provider_methods.dto'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceType from '#features/catalogs/domain/models/service_type'
import PaymentMethod from '#features/catalogs/domain/models/payment_method'
import Provider from '#features/catalogs/domain/models/provider'

@inject()
export default class CreateSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(data: ServiceProviderMethodCreateDto) {
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

    return this.repository.create(data as any)
  }
}
