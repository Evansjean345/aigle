import Provider, { ProviderType } from '#shared/models/provider'

export interface ListProvidersParams {
  page?: number
  limit?: number
  q?: string
  type?: ProviderType
}

export interface ProviderRepositoryContract {
  paginate(params: ListProvidersParams): Promise<any>
  findByIdOrFail(id: number): Promise<Provider>
  create(data: { code: string; name: string; type: ProviderType }): Promise<Provider>
  update(
    id: number,
    data: Partial<{ code: string; name: string; type: ProviderType }>
  ): Promise<Provider>
  delete(id: number): Promise<void>
}
