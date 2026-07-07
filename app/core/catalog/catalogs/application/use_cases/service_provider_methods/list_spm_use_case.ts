import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#core/catalog/catalogs/domain/interfaces/service_provider_method_repository'
import {
  type ListServiceProviderMethodsQuery,
  ServiceProviderMethodListResponseDTO,
} from '#core/catalog/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

@inject()
export default class ListSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(params: ListServiceProviderMethodsQuery) {
    const paginator = await this.repository.paginate(params)
    return ServiceProviderMethodListResponseDTO.fromPaginator(paginator)
  }
}
