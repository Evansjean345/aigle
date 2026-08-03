import { inject } from '@adonisjs/core'
import TransferApprovalService from '#core/money/transfer/application/services/transfer_approval_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import type { MassTransferActor } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Approuve un lot de décaissements en attente.
 *
 * Résout si l'approbateur est propriétaire de l'organisation, ce dont dépend l'autorisation
 * d'approuver un lot qu'il a lui-même initié, puis délègue au service d'approbation du core.
 */
@inject()
export default class ApproveMassTransferUseCase {
  constructor(
    private readonly approvalService: TransferApprovalService,
    private readonly membershipService: MembershipService
  ) {}

  /**
   * Approuve le lot au nom de l'acteur.
   *
   * @param {string} reference - Référence du lot à approuver.
   * @param {MassTransferActor} actor - Membre qui approuve.
   * @param {string} organisationId - Organisation propriétaire du lot.
   * @returns {Promise<void>} Rien.
   */
  async execute(
    reference: string,
    actor: MassTransferActor,
    organisationId: string
  ): Promise<void> {
    const approverUid = String(actor.usersUid)
    const isOwner = await this.membershipService.isOwner(organisationId, approverUid)
    await this.approvalService.approve(reference, approverUid, isOwner)
  }
}
