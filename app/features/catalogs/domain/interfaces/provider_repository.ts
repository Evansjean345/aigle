import Provider, { ProviderType } from '#features/catalogs/domain/models/provider'

export interface ListProvidersParams {
  page?: number
  limit?: number
  q?: string
  type?: ProviderType
}

export default abstract class ProviderRepository {
  abstract paginate(params: ListProvidersParams): Promise<any>
  abstract findByIdOrFail(id: number): Promise<Provider>
  abstract create(data: { code: string; name: string; type: ProviderType }): Promise<Provider>
  abstract update(
    id: number,
    data: Partial<{ code: string; name: string; type: ProviderType }>
  ): Promise<Provider>
  abstract delete(id: number): Promise<void>
}
