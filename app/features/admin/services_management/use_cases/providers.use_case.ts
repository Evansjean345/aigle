import { inject } from '@adonisjs/core'
import ProvidersService from '../services/providers.service.js'
import { ListProvidersParams } from '#shared/interfaces/services_management/index'
import { ProviderCreateDto, ProviderUpdateDto } from '#admin/services_management/dtos/providers.dto.js'

@inject()
export default class ProvidersUseCase {
  constructor(private readonly service: ProvidersService) {}

  list(params: ListProvidersParams) {
    return this.service.list(params)
  }

  get(id: number) {
    return this.service.get(id)
  }

  create(payload: ProviderCreateDto) {
    return this.service.create(payload)
  }

  update(id: number, payload: ProviderUpdateDto) {
    return this.service.update(id, payload)
  }

  delete(id: number) {
    return this.service.delete(id)
  }
}
