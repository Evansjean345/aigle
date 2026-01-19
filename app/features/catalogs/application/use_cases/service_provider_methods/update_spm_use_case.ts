import { inject } from '@adonisjs/core'
import { ServiceProviderMethodUpdateDto } from '#features/catalogs/application/dtos/service_provider_methods.dto'
import ServiceProviderMethodsService from '#features/catalogs/application/services/service_provider_methods.service'

@inject()
export default class UpdateSpmUseCase {
  constructor(private readonly service: ServiceProviderMethodsService) {}

  execute(id: number, payload: ServiceProviderMethodUpdateDto) {
    return this.service.update(id, payload)
  }
}
