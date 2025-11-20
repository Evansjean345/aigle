import { inject } from '@adonisjs/core'
import {
  ProviderCreateDto,
  ProviderUpdateDto,
} from '#features/catalogs/application/dtos/providers.dto'
import ProvidersService from '#features/catalogs/application/services/providers.service'
import { ListProvidersParams } from '#features/catalogs/domain/interfaces/provider_repository'

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
