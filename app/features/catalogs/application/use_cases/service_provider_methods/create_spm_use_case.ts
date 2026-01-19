import { inject } from '@adonisjs/core'
import { ServiceProviderMethodCreateDto } from '#features/catalogs/application/dtos/service_provider_methods.dto'
import ServiceProviderMethodsService from '#features/catalogs/application/services/service_provider_methods.service'

@inject()
export default class CreateSpmUseCase {
  constructor(private readonly service: ServiceProviderMethodsService) {}

  execute(payload: ServiceProviderMethodCreateDto) {
    return this.service.create(payload)
  }
}
