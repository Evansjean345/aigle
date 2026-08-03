import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { AuditResult } from '#core/audit/domain/enums'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import UnfreezeOnBlockedOrganisationException from '#aiglebusiness/organisation/domain/exceptions/unfreeze_on_blocked_organisation_exception'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { FreezeOrganisationWalletCommand } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'
import { OrganisationWalletStateResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'

/**
 * Gèle ou dégèle le portefeuille d'une organisation depuis le back-office.
 *
 * Un portefeuille gelé fait refuser tout encaissement et tout décaissement, y compris les lots de
 * paiement déjà approuvés, dont les lignes restent en attente sans être versées ni rendues.
 *
 * Le dégel exige une organisation active : l'accès est rendu avant l'argent.
 */
@inject()
export default class FreezeOrganisationWalletForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly wallets: WalletService
  ) {}

  /**
   * Exécute la bascule.
   *
   * @param {FreezeOrganisationWalletCommand} command - Organisation visée, sens, motif et auteur.
   * @returns {Promise<OrganisationWalletStateResponseDTO>} Le portefeuille dans son nouvel état.
   * @throws {OrganisationNotFoundException} Identifiant d'organisation inconnu.
   * @throws {UnfreezeOnBlockedOrganisationException} Dégel demandé sur une organisation bloquée.
   * @throws {WalletNotFoundException} L'organisation n'a pas de portefeuille.
   */
  async execute(
    command: FreezeOrganisationWalletCommand
  ): Promise<OrganisationWalletStateResponseDTO> {
    const organisation = await this.organisations.findByOrganisationId(command.organisationId)

    if (!organisation) throw new OrganisationNotFoundException()

    if (!command.frozen && organisation.status !== OrganisationStatus.ACTIVE) {
      throw new UnfreezeOnBlockedOrganisationException()
    }

    const status = command.frozen ? WalletStatus.Inactive : WalletStatus.Active
    await this.wallets.updateWalletStatusByAccountId(command.organisationId, status)

    emitter
      .emit('activity:audit', {
        eventCategory: 'ORGANISATION',
        eventAction: command.frozen ? 'FREEZE_WALLET' : 'UNFREEZE_WALLET',
        actorId: command.adminId,
        actorType: 'admin',
        targetType: 'organisation',
        targetId: command.organisationId,
        metadata: { reason: command.reason },
        result: AuditResult.SUCCESS,
      })
      .catch(() => {})

    return OrganisationWalletStateResponseDTO.fromStatus(command.organisationId, status)
  }
}
