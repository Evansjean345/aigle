import { inject } from '@adonisjs/core'
import ServiceTypeRepository from '#shared/repositories/services_management/service_type.repository'
import { ListServiceTypesParams } from '#shared/interfaces/services_management/index'
import { ServiceTypeCreateDto, ServiceTypeUpdateDto } from '#admin/services_management/dtos/service_types.dto.js'

@inject()
export default class ServiceTypesService {
  constructor(private readonly repo: ServiceTypeRepository) {}

  list(params: ListServiceTypesParams) {
    return this.repo.paginate(params)
  }

  get(id: number) {
    return this.repo.findByIdOrFail(id)
  }

  async create(data: ServiceTypeCreateDto) {
    if (!data.code || !data.label) {
      throw new Error('code and label are required')
    }
    return this.repo.create({ code: data.code, label: data.label, description: data.description })
  }

  update(id: number, data: ServiceTypeUpdateDto) {
    return this.repo.update(id, data)
  }

  delete(id: number) {
    return this.repo.delete(id)
  }
}
