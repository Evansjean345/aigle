import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import TransferBatchNotFoundException from '#core/money/transfer/domain/exceptions/transfer_batch_not_found_exception'
import MassTransferActorResolver from '#aiglebusiness/transfer/mass/application/services/mass_transfer_actor_resolver'
import {
  MassTransferAdminResponseDTO,
  MassTransferAdminDetailResponseDTO,
} from '#aiglebusiness/transfer/mass/application/dtos/admin/admin_mass_transfer.dto'
import { listMassTransfersForAdminValidator } from '#aiglebusiness/transfer/mass/presentation/admin/validators/admin_mass_transfer_validators'

/**
 * Consultation des lots de paiement en masse depuis l'espace admin.
 *
 * **Lecture seule.** L'approbation d'un lot est un contrôle interne à l'organisation, entre deux de
 * ses membres : Aigle la consulte, ne s'y substitue pas.
 */
@inject()
export default class AdminMassTransfersController {
  constructor(
    private readonly queryService: TransferQueryService,
    private readonly actors: MassTransferActorResolver
  ) {}

  /**
   * Liste les lots de toutes les organisations, filtrables par statut et par organisation.
   *
   * Les plus récents d'abord : on regarde d'abord ce qui vient de se passer.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { status, organisationId } = await request.validateUsing(
      listMassTransfersForAdminValidator,
      { data: request.qs() }
    )

    const batches = await this.queryService.listForAdmin(status, organisationId)
    const names = await this.actors.resolveOrganisations(batches)

    return response.ok({
      data: batches.map((batch) => MassTransferAdminResponseDTO.fromAdminBatchResult(batch, names)),
    })
  }

  /** Détail d'un lot et de ses bénéficiaires, sans restriction d'organisation. */
  async show({ response, params }: HttpContext): Promise<void> {
    const detail = await this.queryService.getBatchDetailForAdmin(params.reference as string)

    if (!detail) throw new TransferBatchNotFoundException()

    const names = await this.actors.resolve([detail])

    return response.ok({
      data: MassTransferAdminDetailResponseDTO.fromAdminBatchDetailResult(detail, names),
    })
  }
}
