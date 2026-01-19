import { inject } from '@adonisjs/core'
import ServiceProviderMethodsService from '#features/catalogs/application/services/service_provider_methods.service'

@inject()
export default class DeleteSpmUseCase {
  constructor(private readonly service: ServiceProviderMethodsService) {}

  execute(id: number) {
    return this.service.delete(id)
  }
}
