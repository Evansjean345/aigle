import type Provider from '#core/catalogs/domain/models/provider'
import type { ProviderStatus } from '#core/catalogs/domain/enums/provider_enums'
import type {
  ListProvidersQuery,
  CreateProviderCommand,
  UpdateProviderCommand,
} from '#core/catalogs/domain/types/provider_repository_types'

export default abstract class ProviderRepository {
  abstract paginate(params: ListProvidersQuery): Promise<any>
  abstract findByIdOrFail(id: number): Promise<Provider>
  abstract findByCode(code: string): Promise<Provider>
  abstract create(data: CreateProviderCommand): Promise<Provider>
  abstract update(id: number, data: UpdateProviderCommand): Promise<Provider>
  abstract setStatus(id: number, status: ProviderStatus): Promise<Provider>
  abstract delete(id: number): Promise<void>
}
