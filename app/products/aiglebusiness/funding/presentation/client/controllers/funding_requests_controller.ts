import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import FundingRequestService from '#aiglebusiness/funding/application/services/funding_request_service'
import CollectionAccountService from '#aiglebusiness/funding/application/services/collection_account_service'
import { FundingRequestResponseDTO } from '#aiglebusiness/funding/application/dtos/funding_request.dto'
import { CollectionAccountResponseDTO } from '#aiglebusiness/funding/application/dtos/collection_account.dto'
import {
  declareFundingRequestValidator,
  listFundingRequestsValidator,
} from '#aiglebusiness/funding/presentation/client/validators/funding_request_validators'
import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type User from '#core/identity/user/domain/models/user'

/**
 * Déclarations de versement côté marchand : création, consultation et annulation.
 *
 * L'organisation vient de l'URL, déjà autorisée en amont par le middleware de permission, et est
 * propagée à chaque appel du service comme critère de recherche.
 */
@inject()
export default class FundingRequestsController {
  constructor(
    private readonly service: FundingRequestService,
    private readonly collectionAccounts: CollectionAccountService
  ) {}

  async store({ request, response, params, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(declareFundingRequestValidator)
    const user = auth.user! as User

    const created = await this.service.declare({
      organisationId: params.organisationId as string,
      declaredByUserId: user.usersUid,
      collectionAccountReference: payload.collectionAccountReference,
      declaredAmount: payload.declaredAmount,
      document: payload.document,
    })

    return response.created({ data: await this.present(created) })
  }

  async index({ request, response, params }: HttpContext): Promise<void> {
    const { status } = await request.validateUsing(listFundingRequestsValidator, {
      data: request.qs(),
    })

    const requests = await this.service.list(params.organisationId as string, status)

    return response.ok({
      data: await Promise.all(requests.map((item) => this.present(item))),
    })
  }

  async show({ response, params }: HttpContext): Promise<void> {
    const found = await this.service.get(
      params.organisationId as string,
      params.reference as string
    )

    return response.ok({ data: await this.present(found) })
  }

  async cancel({ response, params }: HttpContext): Promise<void> {
    const cancelled = await this.service.cancel(
      params.organisationId as string,
      params.reference as string
    )

    return response.ok({ data: await this.present(cancelled) })
  }

  /**
   * Assemble la vue marchand : URL signée du justificatif et compte de collecte visé.
   *
   * Le compte est renvoyé même s'il a été désactivé depuis la déclaration.
   *
   * @param {FundingRequest} request - Demande à exposer.
   * @returns {Promise<FundingRequestResponseDTO>} La vue complète.
   */
  private async present(request: FundingRequest): Promise<FundingRequestResponseDTO> {
    const [documentUrl, account] = await Promise.all([
      this.service.documentUrl(request),
      this.collectionAccounts.findByReference(request.collectionAccountReference),
    ])

    return FundingRequestResponseDTO.fromRequest(
      request,
      documentUrl,
      account ? CollectionAccountResponseDTO.fromAccount(account) : null
    )
  }
}
