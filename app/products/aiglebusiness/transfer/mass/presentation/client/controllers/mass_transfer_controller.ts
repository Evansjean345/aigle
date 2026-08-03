import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InitiateMassTransferUseCase from '#aiglebusiness/transfer/mass/application/use_cases/initiate_mass_transfer.use_case'
import ApproveMassTransferUseCase from '#aiglebusiness/transfer/mass/application/use_cases/approve_mass_transfer.use_case'
import RejectMassTransferUseCase from '#aiglebusiness/transfer/mass/application/use_cases/reject_mass_transfer.use_case'
import ListMassTransfersUseCase from '#aiglebusiness/transfer/mass/application/use_cases/list_mass_transfers.use_case'
import GetMassTransferUseCase from '#aiglebusiness/transfer/mass/application/use_cases/get_mass_transfer.use_case'
import SimulateMassTransferUseCase from '#aiglebusiness/transfer/mass/application/use_cases/simulate_mass_transfer.use_case'
import { massTransferValidator } from '#aiglebusiness/transfer/mass/presentation/client/validators/mass_transfer_validators'
import type {
  MassTransferActor,
  MassTransferRequestDto,
} from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Points d'entrée HTTP du paiement en masse : simulation, initiation, consultation et approbation.
 *
 * Valide la requête, réduit le membre authentifié à un acteur d'audit, puis délègue aux use cases.
 * L'autorisation est assurée en amont par les middlewares.
 */
@inject()
export default class MassTransferController {
  constructor(
    private readonly initiateMassTransfer: InitiateMassTransferUseCase,
    private readonly approveMassTransfer: ApproveMassTransferUseCase,
    private readonly rejectMassTransfer: RejectMassTransferUseCase,
    private readonly listMassTransfers: ListMassTransfersUseCase,
    private readonly getMassTransfer: GetMassTransferUseCase,
    private readonly simulateMassTransfer: SimulateMassTransferUseCase
  ) {}

  /**
   * Chiffre un lot avant de l'engager : coût total et montant restant à approvisionner.
   *
   * Lecture pure, et même validateur que l'initiation : on ne simule que ce qui pourrait réellement
   * être envoyé.
   */
  async simulate({ request, response, params }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(massTransferValidator)
    const organisationId = params.organisationId as string

    const dto: MassTransferRequestDto = {
      label: payload.label,
      description: payload.description,
      recipients: payload.recipients.map((r) => ({
        amount: r.amount,
        phone: r.phone,
        providerCode: r.providerCode,
        name: r.name,
        country: r.country,
      })),
    }

    const data = await this.simulateMassTransfer.execute(dto, organisationId)
    return response.ok({ data })
  }

  /** Liste les lots de l'organisation, filtrables par statut via le paramètre `status`. */
  async index({ request, response, params }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const status = request.input('status') as string | undefined
    const data = await this.listMassTransfers.execute(organisationId, status)
    return response.ok({ data })
  }

  /** Renvoie le détail d'un lot et de ses bénéficiaires. */
  async show({ response, params }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const reference = params.reference as string
    const data = await this.getMassTransfer.execute(organisationId, reference)
    return response.ok({ data })
  }

  /** Initie un lot. Répond `202` : le lot est créé en attente d'approbation. */
  async create({ request, response, auth, params }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(massTransferValidator)

    const organisationId = params.organisationId as string
    const member = auth.user! as { id: number; usersUid: string }
    const idempotencyKey = request.header('X-Idempotency-Key')

    const dto: MassTransferRequestDto = {
      label: payload.label,
      description: payload.description,
      recipients: payload.recipients.map((r) => ({
        amount: r.amount,
        phone: r.phone,
        providerCode: r.providerCode,
        name: r.name,
        country: r.country,
      })),
    }

    const actor: MassTransferActor = { id: member.id, usersUid: member.usersUid }

    const result = await this.initiateMassTransfer.execute(
      dto,
      actor,
      organisationId,
      idempotencyKey
    )
    return response.accepted(result)
  }

  /** Approuve un lot en attente, ce qui le met en file d'exécution. */
  async approve({ response, auth, params }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const reference = params.reference as string
    const actor = this.actor(auth)

    await this.approveMassTransfer.execute(reference, actor, organisationId)
    return response.ok({ message: 'lot approuvé', data: { reference, status: 'queued' } })
  }

  /** Rejette un lot en attente et libère les fonds réservés. */
  async reject({ request, response, auth, params }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const reference = params.reference as string
    const reason = request.input('reason') as string | undefined
    const actor = this.actor(auth)

    await this.rejectMassTransfer.execute(reference, actor, organisationId, reason)
    return response.ok({ message: 'lot rejeté', data: { reference, status: 'rejected' } })
  }

  /**
   * Réduit le membre authentifié à l'acteur d'audit attendu par les use cases.
   *
   * @param {HttpContext['auth']} auth - Contexte d'authentification de la requête.
   * @returns {MassTransferActor} L'acteur à tracer.
   */
  private actor(auth: HttpContext['auth']): MassTransferActor {
    const member = auth.user! as { id: number; usersUid: string }
    return { id: member.id, usersUid: member.usersUid }
  }
}
