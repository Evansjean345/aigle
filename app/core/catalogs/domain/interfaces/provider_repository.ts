import type Provider from '#core/catalogs/domain/models/provider'
import {
  type ListProvidersRequestDto,
  type CreateProviderCommand,
  type UpdateProviderCommand,
  type ProviderStatus,
} from '#core/catalogs/application/dtos/admin/admin_providers.dto'

export default abstract class ProviderRepository {
  abstract paginate(params: ListProvidersRequestDto): Promise<any>
  abstract findByIdOrFail(id: number): Promise<Provider>
  abstract findByCode(code: string): Promise<Provider>
  abstract create(data: CreateProviderCommand): Promise<Provider>
  abstract update(id: number, data: UpdateProviderCommand): Promise<Provider>
  abstract setStatus(id: number, status: ProviderStatus): Promise<Provider>
  abstract delete(id: number): Promise<void>
}
