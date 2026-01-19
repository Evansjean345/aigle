import { inject } from '@adonisjs/core'
import { ListSpmParams } from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceProviderMethodsService from '#features/catalogs/application/services/service_provider_methods.service'

@inject()
export default class ListSpmUseCase {
  constructor(private readonly service: ServiceProviderMethodsService) {}

  execute(params: ListSpmParams) {
    return this.service.list(params)
  }
}
