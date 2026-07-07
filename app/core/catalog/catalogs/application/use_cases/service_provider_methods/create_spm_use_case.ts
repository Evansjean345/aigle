import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#core/catalog/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceType from '#core/catalog/catalogs/domain/models/service_type'
import PaymentMethod from '#core/catalog/catalogs/domain/models/payment_method'
import Provider from '#core/catalog/catalogs/domain/models/provider'
import {
  type CreateServiceProviderMethodRequestDto,
  ServiceProviderMethodResponseDTO,
} from '#core/catalog/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

@inject()
export default class CreateSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(data: CreateServiceProviderMethodRequestDto) {
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

    const created = await this.repository.create({
      serviceTypeId: data.serviceTypeId,
      paymentMethodId: data.paymentMethodId,
      providerFromId: data.providerFromId,
      providerToId: data.providerToId,
      feeFixed: data.feeFixed,
      feePercent: data.feePercent,
      minAmount: data.minAmount,
      currency: data.currency,
      isActive: data.isActive,
    })

    return ServiceProviderMethodResponseDTO.fromServiceProviderMethod(created)
  }
}
