import { inject } from '@adonisjs/core'
import ServiceTypesService from '../services/service_types.service.js'
import { ListServiceTypesParams } from '#shared/interfaces/services_management/index.js'
import { ServiceTypeCreateDto, ServiceTypeUpdateDto } from '#admin/services_management/dtos/service_types.dto.js'

@inject()
export default class ServiceTypesUseCase {
  constructor(private readonly service: ServiceTypesService) {}

  /**
   * Retrieves a list of items based on the provided parameters.
   *
   * @param {ListServiceTypesParams} params - The parameters to query the list of items.
   * @return {any} - The result of the list operation from the service.
   */
  list(params: ListServiceTypesParams): any {
    return this.service.list(params)
  }

  get(id: number) {
    return this.service.get(id)
  }

  create(payload: ServiceTypeCreateDto) {
    return this.service.create(payload)
  }

  update(id: number, payload: ServiceTypeUpdateDto) {
    return this.service.update(id, payload)
  }

  delete(id: number) {
    return this.service.delete(id)
  }
}
