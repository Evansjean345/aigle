import { inject } from '@adonisjs/core'
import {
  ServiceProviderMethodCreateDto,
  ServiceProviderMethodUpdateDto,
} from '#admin/services_management/dtos/service_provider_methods.dto'
import { ListSpmParams } from '#shared/interfaces/services_management/service_provider_method_repository'
import ServiceProviderMethodsService from '#admin/services_management/services/service_provider_methods.service'

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
