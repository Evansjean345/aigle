import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import {
  type ListServiceProviderMethodsRequestDto,
  ServiceProviderMethodListResponseDTO,
} from '#features/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

@inject()
export default class ListSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(params: ListServiceProviderMethodsRequestDto) {
    const paginator = await this.repository.paginate(params)
    return ServiceProviderMethodListResponseDTO.fromPaginator(paginator)
  }
}
