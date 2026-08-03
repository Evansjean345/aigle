import { inject } from '@adonisjs/core'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'
import type {
  MassTransferActor,
  MassTransferRequestDto,
  MassTransferResponseDTO,
} from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Initie un lot de décaissements depuis le compte d'une organisation.
 *
 * Se limite à traduire la requête vers le contrat du core, puis à déléguer : l'idempotence, la
 * réservation des fonds et les statuts du lot sont portés par le service de lots.
 *
 * La source est le compte de l'organisation ; l'initiateur n'est que l'acteur d'audit.
 */
@inject()
export default class InitiateMassTransferUseCase {
  constructor(private readonly transferBatchService: TransferBatchService) {}

  /**
   * Construit la commande de lot et la transmet au service du core.
   *
   * @param {MassTransferRequestDto} payload - Libellé, description et liste des bénéficiaires.
   * @param {MassTransferActor} actor - Membre à l'origine de la demande, conservé pour l'audit.
   * @param {string} organisationId - Organisation débitée, qui sert de compte source.
   * @param {string} [idempotencyKey] - Clé d'idempotence de la requête.
   * @returns {Promise<MassTransferResponseDTO>} Référence, statut et nombre de bénéficiaires du lot,
   * avec un message distinct si le lot existait déjà.
   */
  async execute(
    payload: MassTransferRequestDto,
    actor: MassTransferActor,
    organisationId: string,
    idempotencyKey?: string
  ): Promise<MassTransferResponseDTO> {
    const command: InitiateMassTransferCommand = {
      accountId: organisationId,
      initiatedBy: String(actor.usersUid),
      label: payload.label,
      description: payload.description,
      idempotencyKey,
      recipients: payload.recipients.map((r) => ({
        amount: Number(r.amount),
        phone: r.phone,
        operator: r.providerCode,
        name: r.name,
        country: r.country,
      })),
    }

    const result = await this.transferBatchService.initiate(command)

    return {
      message: result.alreadyExisted ? 'lot de transfert déjà initié' : 'lot de transfert initié',
      data: {
        batchReference: result.reference,
        status: result.status,
        expectedCount: result.expectedCount,
      },
    }
  }
}
