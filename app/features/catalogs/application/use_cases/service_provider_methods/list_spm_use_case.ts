import { inject } from '@adonisjs/core'
import ServiceProviderMethodRepository, {
  ListSpmParams,
} from '#features/catalogs/domain/interfaces/service_provider_method_repository'

@inject()
export default class ListSpmUseCase {
  constructor(private readonly repository: ServiceProviderMethodRepository) {}

  execute(params: ListSpmParams) {
    return this.repository.paginate(params)
  }
}
