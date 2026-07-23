import { inject } from '@adonisjs/core'
import TransferApprovalService from '#core/money/transfer/application/services/transfer_approval_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import type { MassTransferActor } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Approbation d'un lot de mass-transfer (maker-checker, B8). Le produit résout le rôle **OWNER** de
 * l'acteur (pour l'exception self-approve) puis délègue au service core. L'auth membre +
 * `transfer:approve` est assurée par les middlewares.
 */
@inject()
export default class ApproveMassTransferUseCase {
  constructor(
    private readonly approvalService: TransferApprovalService,
    private readonly membershipService: MembershipService
  ) {}

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
