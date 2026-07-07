import type ServiceProviderMethod from '#core/catalogs/domain/models/service_provider_method'
import type {
  ListServiceProviderMethodsQuery,
  CreateServiceProviderMethodCommand,
  UpdateServiceProviderMethodCommand,
} from '#core/catalogs/domain/types/service_provider_method_repository_types'

export default abstract class ServiceProviderMethodRepository {
  abstract paginate(params: ListServiceProviderMethodsQuery): Promise<any>
  abstract findByIdOrFail(id: number): Promise<ServiceProviderMethod>
  abstract findByIdWithRelationsOrFail(id: number): Promise<ServiceProviderMethod>
  abstract create(data: CreateServiceProviderMethodCommand): Promise<ServiceProviderMethod>
  abstract update(
    id: number,
    data: UpdateServiceProviderMethodCommand
  ): Promise<ServiceProviderMethod>
  abstract delete(id: number): Promise<void>
}
