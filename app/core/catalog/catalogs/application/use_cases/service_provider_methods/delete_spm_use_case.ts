import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#core/catalog/catalogs/domain/interfaces/service_provider_method_repository'

@inject()
export default class DeleteSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  execute(id: number) {
    return this.repository.delete(id)
  }
}
