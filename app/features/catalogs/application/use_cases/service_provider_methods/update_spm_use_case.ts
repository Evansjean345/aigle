import { inject } from '@adonisjs/core'
import { ServiceProviderMethodUpdateDto } from '#features/catalogs/application/dtos/service_provider_methods.dto'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'

@inject()
export default class UpdateSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  execute(id: number, payload: ServiceProviderMethodUpdateDto) {
    return this.repository.update(id, payload)
  }
}
