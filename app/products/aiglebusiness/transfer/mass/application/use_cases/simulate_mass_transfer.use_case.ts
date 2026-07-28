import { inject } from '@adonisjs/core'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'
import type { MassTransferRequestDto } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'
import type { MassTransferSimulation } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Use case **simulation de frais** (B11) — routeur mince, strictement symétrique de l'initiation.
 *
 * Répond à « **combien dois-je approvisionner ?** » avant d'engager quoi que ce soit. Le mapping des
 * bénéficiaires est **identique** à celui de `InitiateMassTransferUseCase` (`providerCode → operator`)
 * et le core appelle la même fonction de tarification : le devis ne peut donc pas diverger du débit
 * réel (L2-D33).
 *
 * **Lecture pure** : aucune écriture, aucune réservation. Pas de clé d'idempotence — simuler deux
 * fois n'a aucun effet de bord à dédupliquer.
 */
@inject()
export default class SimulateMassTransferUseCase {
  constructor(private readonly transferBatchService: TransferBatchService) {}

  async execute(
    payload: MassTransferRequestDto,
    organisationId: string
  ): Promise<MassTransferSimulation> {
    const command: InitiateMassTransferCommand = {
      accountId: organisationId,
      // Aucun mouvement n'est initié : l'acteur ne sert qu'à la signature du contrat core.
      initiatedBy: 'simulation',
      label: payload.label,
      recipients: payload.recipients.map((r) => ({
        amount: Number(r.amount),
        phone: r.phone,
        operator: r.providerCode,
        name: r.name,
        country: r.country,
      })),
    }

    return this.transferBatchService.simulate(command)
  }
}
