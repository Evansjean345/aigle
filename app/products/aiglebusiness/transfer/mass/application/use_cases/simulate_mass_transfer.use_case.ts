import { inject } from '@adonisjs/core'
import TransferBatchService from '#core/money/transfer/application/services/transfer_batch_service'
import type { InitiateMassTransferCommand } from '#core/money/transfer/application/dtos/transfer.dto'
import type { MassTransferRequestDto } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'
import type { MassTransferSimulationResult } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Calcule le coût d'un lot de décaissements sans l'engager.
 *
 * Lecture pure : ni écriture, ni réservation de fonds, donc pas de clé d'idempotence. Le mapping des
 * bénéficiaires est identique à celui de l'initiation et le core applique la même tarification, ce
 * qui garantit que le devis ne diverge pas du débit réel.
 */
@inject()
export default class SimulateMassTransferUseCase {
  constructor(private readonly transferBatchService: TransferBatchService) {}

  /**
   * Chiffre le lot sans rien engager.
   *
   * @param {MassTransferRequestDto} payload - Libellé et liste des bénéficiaires à chiffrer.
   * @param {string} organisationId - Organisation qui serait débitée.
   * @returns {Promise<MassTransferSimulationResult>} Coût total et montant restant à approvisionner.
   */
  async execute(
    payload: MassTransferRequestDto,
    organisationId: string
  ): Promise<MassTransferSimulationResult> {
    const command: InitiateMassTransferCommand = {
      accountId: organisationId,
      // Aucun mouvement n'est initié : l'acteur ne sert qu'à satisfaire le contrat du core.
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
