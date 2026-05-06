import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository from '#features/catalogs/domain/interfaces/service_provider_method_repository'
import {
  type UpdateServiceProviderMethodRequestDto,
  ServiceProviderMethodResponseDTO,
} from '#features/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

@inject()
export default class UpdateSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  async execute(id: number, payload: UpdateServiceProviderMethodRequestDto) {
    const updated = await this.repository.update(id, payload)
    return ServiceProviderMethodResponseDTO.fromServiceProviderMethod(updated)
  }
}
