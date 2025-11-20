import { inject } from '@adonisjs/core'
import {
  ServiceProviderMethodCreateDto,
  ServiceProviderMethodUpdateDto,
} from '#features/catalogs/application/dtos/service_provider_methods.dto'
import { ListSpmParams } from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import ServiceProviderMethodsService from '#features/catalogs/application/services/service_provider_methods.service'

@inject()
export default class ServiceProviderMethodsUseCase {
  constructor(private readonly service: ServiceProviderMethodsService) {}

  list(params: ListSpmParams) {
    return this.service.list(params)
  }

  get(id: number) {
    return this.service.get(id)
  }

  create(payload: ServiceProviderMethodCreateDto) {
    return this.service.create(payload)
  }

  update(id: number, payload: ServiceProviderMethodUpdateDto) {
    return this.service.update(id, payload)
  }

  delete(id: number) {
    return this.service.delete(id)
  }
}
