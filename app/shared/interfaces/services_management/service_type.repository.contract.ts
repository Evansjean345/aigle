import ServiceType from '#shared/models/service_type'

export interface ListServiceTypesParams {
  page?: number
  limit?: number
  q?: string
}

export abstract class ServiceTypeRepositoryContract {
  abstract paginate(params: ListServiceTypesParams): Promise<any>
  abstract findByIdOrFail(id: number): Promise<ServiceType>
  abstract create(data: {
    code: string
    label: string
    description?: string | null
  }): Promise<ServiceType>
  abstract update(
    id: number,
    data: Partial<{ code: string; label: string; description?: string | null }>
  ): Promise<ServiceType>
  abstract delete(id: number): Promise<void>
}
