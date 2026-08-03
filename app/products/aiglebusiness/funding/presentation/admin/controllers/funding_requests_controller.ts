import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import FundingRequestReviewService from '#aiglebusiness/funding/application/services/funding_request_review_service'
import FundingRequestService from '#aiglebusiness/funding/application/services/funding_request_service'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import FundingActorResolver from '#aiglebusiness/funding/application/services/funding_actor_resolver'
import { FundingRequestAdminResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_funding_request.dto'
import { CollectionAccountAdminResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_collection_account.dto'
import {
  approveFundingRequestValidator,
  confirmFundingRequestValidator,
  rejectFundingRequestValidator,
  listFundingRequestsForReviewValidator,
} from '#aiglebusiness/funding/presentation/admin/validators/funding_request_validators'
import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { FundingActorNamesResult } from '#aiglebusiness/funding/application/dtos/admin/admin_funding_request.dto'
import type Admin from '#core/team/domain/models/admin'

/**
 * Revue des demandes de réapprovisionnement par le back-office.
 *
 * L'identité du gestionnaire est prise de la session et non du corps de la requête.
 */
@inject()
export default class AdminFundingRequestsController {
  constructor(
    private readonly review: FundingRequestReviewService,
    private readonly requests: FundingRequestService,
    private readonly collectionAccounts: CollectionAccountService,
    private readonly actors: FundingActorResolver
  ) {}

  /** Renvoie la file de traitement, toutes organisations, les plus anciennes d'abord. */
  async index({ request, response }: HttpContext): Promise<void> {
    const { status, organisationId } = await request.validateUsing(
      listFundingRequestsForReviewValidator,
      { data: request.qs() }
    )

    const items = await this.review.listForReview(status, organisationId)
    const names = await this.actors.resolveOrganisations(items)

    return response.ok({
      data: await Promise.all(items.map((item) => this.present(item, names))),
    })
  }

  async show({ response, params }: HttpContext): Promise<void> {
    const found = await this.review.getForReview(params.reference as string)
    return response.ok({ data: await this.present(found) })
  }

  /**
   * Valide la demande.
   *
   * Crédite immédiatement si le montant déclaré est sous le seuil, sinon met la demande en attente
   * d'un second gestionnaire sans déplacer d'argent.
   */
  async approve({ request, response, params, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(approveFundingRequestValidator)
    const admin = auth.getUserOrFail() as Admin

    const approved = await this.review.approve({
      reference: params.reference as string,
      verifiedAmount: payload.verifiedAmount,
      adminId: admin.id,
      comment: payload.comment,
    })

    return response.ok({ data: await this.present(approved) })
  }

  /** Confirme une demande pré-approuvée par un premier gestionnaire, et déclenche le crédit. */
  async confirm({ request, response, params, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(confirmFundingRequestValidator)
    const admin = auth.getUserOrFail() as Admin

    const confirmed = await this.review.confirm({
      reference: params.reference as string,
      adminId: admin.id,
      comment: payload.comment,
    })

    return response.ok({ data: await this.present(confirmed) })
  }

  /** Refuse la demande avec un motif obligatoire. Ne touche pas au wallet. */
  async reject({ request, response, params, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(rejectFundingRequestValidator)
    const admin = auth.getUserOrFail() as Admin

    const rejected = await this.review.reject({
      reference: params.reference as string,
      adminId: admin.id,
      comment: payload.comment,
    })

    return response.ok({ data: await this.present(rejected) })
  }

  /**
   * Assemble la vue back-office : URL signée du justificatif et compte de collecte visé.
   *
   * @param {FundingRequest} request - Demande à exposer.
   * @param {FundingActorNamesResult} [names] - Noms déjà résolus pour un lot. Résolus à la demande sinon.
   * @returns {Promise<FundingRequestAdminResponseDTO>} La vue complète.
   */
  private async present(
    request: FundingRequest,
    names?: FundingActorNamesResult
  ): Promise<FundingRequestAdminResponseDTO> {
    const [documentUrl, account, resolved] = await Promise.all([
      this.requests.documentUrl(request),
      this.collectionAccounts.findByReference(request.collectionAccountReference),
      names ? Promise.resolve(names) : this.actors.resolve([request]),
    ])

    return FundingRequestAdminResponseDTO.fromRequest(
      request,
      documentUrl,
      account ? CollectionAccountAdminResponseDTO.fromAccount(account) : null,
      resolved
    )
  }
}
