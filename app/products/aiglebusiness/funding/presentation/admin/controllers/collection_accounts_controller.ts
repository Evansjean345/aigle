import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { toCollectionAccountAdminView } from '#aiglebusiness/funding/application/dtos/collection_account.dto'
import CollectionAccountIdentifierMismatchException from '#aiglebusiness/funding/domain/exceptions/collection_account_identifier_mismatch_exception'
import {
  createCollectionAccountValidator,
  updateCollectionAccountValidator,
  toggleCollectionAccountValidator,
  assertIdentifierMatchesType,
} from '#aiglebusiness/funding/presentation/admin/validators/collection_account_validators'

/**
 * Administration du catalogue des comptes de collecte (F1).
 *
 * réapprovisionnement référence leur canal — le supprimer rendrait l'historique illisible.
 */
@inject()
export default class CollectionAccountsController {
  constructor(private readonly service: CollectionAccountService) {}

  /** Catalogue complet — actifs et inactifs. */
  async index({ response }: HttpContext): Promise<void> {
    const accounts = await this.service.listAll()
    return response.ok({ data: accounts.map(toCollectionAccountAdminView) })
  }

  async store({ request, response }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createCollectionAccountValidator)

    // Cohérence type ↔ identifiant : dernière barrière avant qu'un marchand verse sur un mauvais
    // numéro, l'identifiant n'étant plus modifiable ensuite.
    if (!assertIdentifierMatchesType(payload.type, payload.accountIdentifier)) {
      throw new CollectionAccountIdentifierMismatchException(payload.type)
    }

    const account = await this.service.create(payload)
    return response.created({ data: toCollectionAccountAdminView(account) })
  }

  /** Met à jour les champs éditables. L'identifiant et le type ne sont pas modifiables (R-D6). */
  async update({ request, response, params }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateCollectionAccountValidator)
    const account = await this.service.update(params.reference as string, payload)
    return response.ok({ data: toCollectionAccountAdminView(account) })
  }

  /** Active/désactive — remplace la suppression. */
  async toggle({ request, response, params }: HttpContext): Promise<void> {
    const { isActive } = await request.validateUsing(toggleCollectionAccountValidator)
    const account = await this.service.setActive(params.reference as string, isActive)
    return response.ok({ data: toCollectionAccountAdminView(account) })
  }
}
