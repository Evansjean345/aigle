import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import { ServiceProviderMethodResponseDTO } from '#features/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

@inject()
export default class GetSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(id: number) {
    const method = await this.repository.findByIdWithRelationsOrFail(id)
    return ServiceProviderMethodResponseDTO.fromServiceProviderMethod(method)
  }
}
