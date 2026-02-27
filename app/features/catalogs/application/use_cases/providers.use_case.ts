import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import {
  ProviderCreateDto,
  ProviderUpdateDto,
} from '#features/catalogs/application/dtos/providers.dto'
import ProviderRepository, {
  ListProvidersParams,
} from '#features/catalogs/domain/interfaces/provider_repository'
import { ProviderType } from '#features/catalogs/domain/models/provider'

export const allowedProviderType: ProviderType[] = ['mobile_money', 'bank', 'credit-card']

@inject()
export default class ProvidersUseCase {
  constructor(private readonly repository: ProviderRepository) {}

  list(params: ListProvidersParams) {
    return this.repository.paginate(params)
  }

  get(id: number) {
    return this.repository.findByIdOrFail(id)
  }

  async create(data: ProviderCreateDto) {
    if (!data.code || !data.name || !data.type) {
      throw new Exception('code, name and type are required', {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    if (!allowedProviderType.includes(data.type)) {
      throw new Exception(`type must be one of: ${allowedProviderType.join(', ')}`, {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    return this.repository.create({ code: data.code, name: data.name, type: data.type })
  }

  async update(id: number, data: ProviderUpdateDto) {
    if (data.type && !allowedProviderType.includes(data.type)) {
      throw new Error(`type must be one of: ${allowedProviderType.join(', ')}`)
    }
    return this.repository.update(id, data)
  }

  delete(id: number) {
    return this.repository.delete(id)
  }
}
