import { inject } from '@adonisjs/core'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'
import type {
  MassTransferActor,
  MassTransferRequestDto,
  MassTransferResponseDTO,
} from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Use case **paiement en masse** business — routeur mince (produit → core par service).
 *
 * Un **membre** (permission `transfer:initiate`) initie un lot de décaissements **depuis le compte de
 * l'organisation**. Le produit ne fait que **traduire** : il résout la **source** (account-centric :
 * `accountId == organisationId'), réduit le membre à un acteur d'audit, mappe les bénéficiaires
 * (`providerCode → operator`), puis délègue au **service core** `TransferBatchService'. Toute la
 * mécanique argent (idempotence, réservation hold, bulk-insert, statuts) vit dans le core ; le produit
 * n'y touche que par le service + ses DTOs (règle `produit-consomme-core-par-service`).
 *
 * Ce qui est **spécifique au produit** (hors de ce use case) : l'auth membre + `transfer:initiate` et
 * le **gate ENTERPRISE** (middlewares), le maker-checker (B8). Ici, uniquement le mapping + la
 * délégation.
 */
@inject()
export default class InitiateMassTransferUseCase {
  constructor(private readonly transferBatchService: TransferBatchService) {}

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
