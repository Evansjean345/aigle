import ServiceType from '#shared/models/service_type'

export interface ListServiceTypesParams {
  page?: number
  limit?: number
  q?: string
}

export interface ServiceTypeRepositoryContract {
  paginate(params: ListServiceTypesParams): Promise<any>
  findByIdOrFail(id: number): Promise<ServiceType>
  create(data: { code: string; label: string; description?: string | null }): Promise<ServiceType>
  update(
    id: number,
    data: Partial<{ code: string; label: string; description?: string | null }>
  ): Promise<ServiceType>
  delete(id: number): Promise<void>
}
