import { inject } from '@adonisjs/core'
import TransferApprovalService from '#core/money/transfer/application/services/transfer_approval_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import type { MassTransferActor } from '#aiglebusiness/transfer/mass/application/dtos/mass_transfer.dto'

/**
 * Rejette un lot de décaissements en attente.
 *
 * Le core passe le lot en `rejected` et libère les fonds réservés. Même résolution du rôle
 * propriétaire que l'approbation.
 */
@inject()
export default class RejectMassTransferUseCase {
  constructor(
    private readonly approvalService: TransferApprovalService,
    private readonly membershipService: MembershipService
  ) {}

  /**
   * Rejette le lot au nom de l'acteur.
   *
   * @param {string} reference - Référence du lot à rejeter.
   * @param {MassTransferActor} actor - Membre qui rejette.
   * @param {string} organisationId - Organisation propriétaire du lot.
   * @param {string} [reason] - Motif du rejet.
   * @returns {Promise<void>} Rien.
   */
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
