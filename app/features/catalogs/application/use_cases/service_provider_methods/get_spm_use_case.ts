import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'

@inject()
export default class GetSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  execute(id: number) {
    return this.repository.findByIdWithRelationsOrFail(id)
  }
}
