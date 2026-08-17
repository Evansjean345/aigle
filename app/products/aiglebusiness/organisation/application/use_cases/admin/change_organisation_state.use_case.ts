import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import UserSessionService from '#core/identity/authentication/application/services/user_session_service'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { AuditResult } from '#core/audit/domain/enums'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { ChangeOrganisationStateCommand } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_moderation.dto'
import { OrganisationStateResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_moderation.dto'

/**
 * Bloque ou débloque une organisation depuis le back-office.
 *
 * Bloquer bascule le statut en `INACTIVE`, gèle le portefeuille et révoque les sessions business
 * des membres. Les sessions aiglesend des mêmes personnes sont conservées.
 *
 * Débloquer rend l'accès mais laisse le portefeuille gelé : le dégel est une action distincte.
 */
@inject()
export default class ChangeOrganisationStateForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly members: OrganisationMemberRepository,
    private readonly sessions: UserSessionService,
    private readonly wallets: WalletService
  ) {}

  /**
   * Exécute la bascule.
   *
   * @param {ChangeOrganisationStateCommand} command - Organisation visée, sens, motif et auteur.
   * @returns {Promise<OrganisationStateResponseDTO>} L'organisation dans son nouvel état.
   * @throws {OrganisationNotFoundException} Identifiant d'organisation inconnu.
   * @throws {WalletNotFoundException} L'organisation n'a pas de portefeuille à geler.
   */
  async execute(command: ChangeOrganisationStateCommand): Promise<OrganisationStateResponseDTO> {
    const existing = await this.organisations.findByOrganisationId(command.organisationId)

    if (!existing) throw new OrganisationNotFoundException()

    const status = command.blocked ? OrganisationStatus.INACTIVE : OrganisationStatus.ACTIVE
    const organisation = await this.organisations.updateStatus(command.organisationId, status)

    let revokedSessions = 0
    if (command.blocked) {
      await this.wallets.updateWalletStatusByAccountId(
        command.organisationId,
        WalletStatus.Inactive
      )

      const userIds = await this.members.listUserIdsByOrganisation(command.organisationId)
      revokedSessions = await this.sessions.revokeAppSessions(userIds, AppName.AIGLEBUSINESS)
    }

    emitter
      .emit('activity:audit', {
        eventCategory: 'ORGANISATION',
        eventAction: command.blocked ? 'BLOCK_ORGANISATION' : 'UNBLOCK_ORGANISATION',
        actorId: command.adminId,
        actorType: 'admin',
        targetType: 'organisation',
        targetId: command.organisationId,
        metadata: { reason: command.reason, revokedSessions },
        result: AuditResult.SUCCESS,
      })
      .catch(() => {})

    return OrganisationStateResponseDTO.fromOrganisation(organisation, revokedSessions)
  }
}
