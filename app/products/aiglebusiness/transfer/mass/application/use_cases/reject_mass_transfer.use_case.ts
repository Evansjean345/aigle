import { inject } from '@adonisjs/core'
import TransferApprovalService from '#core/money/transfer/application/services/transfer_approval_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import type { MassTransferActor } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Rejet d'un lot de mass-transfer (maker-checker, B8) → `rejected` + libération du hold (côté core).
 * Même résolution OWNER + séparation des tâches que l'approbation.
 */
@inject()
export default class RejectMassTransferUseCase {
  constructor(
    private readonly approvalService: TransferApprovalService,
    private readonly membershipService: MembershipService
  ) {}

  async execute(
    reference: string,
    actor: MassTransferActor,
    organisationId: string,
    reason?: string
  ): Promise<void> {
    const approverUid = String(actor.usersUid)
    const isOwner = await this.membershipService.isOwner(organisationId, approverUid)
    await this.approvalService.reject(reference, approverUid, isOwner, reason)
  }
}
