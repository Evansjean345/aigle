import type ServiceProviderMethod from '#features/catalogs/domain/models/service_provider_method'
import {
  type ListServiceProviderMethodsRequestDto,
  type CreateServiceProviderMethodCommand,
  type UpdateServiceProviderMethodCommand,
} from '#features/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

export default abstract class ServiceProviderMethodRepository {
  abstract paginate(params: ListServiceProviderMethodsRequestDto): Promise<any>
  abstract findByIdOrFail(id: number): Promise<ServiceProviderMethod>
  abstract findByIdWithRelationsOrFail(id: number): Promise<ServiceProviderMethod>
  abstract create(data: CreateServiceProviderMethodCommand): Promise<ServiceProviderMethod>
  abstract update(
    id: number,
    data: UpdateServiceProviderMethodCommand
  ): Promise<ServiceProviderMethod>
  abstract delete(id: number): Promise<void>
}
