import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { CollectionAccountAdminResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_collection_account.dto'
import CollectionAccountIdentifierMismatchException from '#aiglebusiness/funding/domain/exceptions/collection_account_identifier_mismatch_exception'
import {
  createCollectionAccountValidator,
  updateCollectionAccountValidator,
  toggleCollectionAccountValidator,
  assertIdentifierMatchesType,
} from '#aiglebusiness/funding/presentation/admin/validators/collection_account_validators'

/** Administration du catalogue des comptes de collecte. */
@inject()
export default class CollectionAccountsController {
  constructor(private readonly service: CollectionAccountService) {}

  /** Renvoie le catalogue complet, actifs et inactifs. */
  async index({ response }: HttpContext): Promise<void> {
    const accounts = await this.service.listAll()
    return response.ok({ data: accounts.map(CollectionAccountAdminResponseDTO.fromAccount) })
  }

  async store({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createCollectionAccountValidator)

    if (!assertIdentifierMatchesType(payload.type, payload.accountIdentifier)) {
      throw new CollectionAccountIdentifierMismatchException(payload.type)
    }

    const account = await this.service.create(payload)
    return response.created({ data: CollectionAccountAdminResponseDTO.fromAccount(account) })
  }

  /** Met à jour les champs éditables. L'identifiant et le type ne le sont pas. */
  async update({ request, response, params }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateCollectionAccountValidator)
    const account = await this.service.update(params.reference as string, payload)
    return response.ok({ data: CollectionAccountAdminResponseDTO.fromAccount(account) })
  }

  /** Active ou désactive un compte. Remplace la suppression. */
  async toggle({ request, response, params }: HttpContext): Promise<void> {
    const { isActive } = await request.validateUsing(toggleCollectionAccountValidator)
    const account = await this.service.setActive(params.reference as string, isActive)
    return response.ok({ data: CollectionAccountAdminResponseDTO.fromAccount(account) })
  }
}
