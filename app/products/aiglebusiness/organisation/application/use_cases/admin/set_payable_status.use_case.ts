import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import PayableAliasNotFoundException from '#aiglebusiness/organisation/domain/exceptions/payable_alias_not_found_exception'
import { AuditResult } from '#core/audit/domain/enums'
import type { SetPayableStatusCommand } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'
import { PayableStatusResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'

/**
 * Ouvre ou suspend l'encaissement d'une organisation.
 *
 * Suspendre coupe les revenus du marchand : le motif est exigé et la décision auditée, pour qu'on
 * puisse toujours dire qui l'a prise et pourquoi.
 */
@inject()
export default class SetPayableStatusForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly aliases: PayableAliasService
  ) {}

  /**
   * Exécute la bascule.
   *
   * @param {SetPayableStatusCommand} command - Organisation visée, nouvel état, motif et auteur.
   * @returns {Promise<PayableStatusResponseDTO>} L'alias dans son nouvel état.
   * @throws {OrganisationNotFoundException} Identifiant d'organisation inconnu.
   * @throws {PayableAliasNotFoundException} L'organisation n'encaisse pas — rien à basculer.
   */
  async execute(command: SetPayableStatusCommand): Promise<PayableStatusResponseDTO> {
    const organisation = await this.organisations.findByOrganisationId(command.organisationId)

    if (!organisation) throw new OrganisationNotFoundException()

    const alias = await this.aliases.setActive(command.organisationId, command.active)

    if (!alias) throw new PayableAliasNotFoundException()

    emitter
      .emit('activity:audit', {
        eventCategory: 'ORGANISATION',
        eventAction: command.active ? 'ENABLE_PAYABLE' : 'DISABLE_PAYABLE',
        actorId: command.adminId,
        actorType: 'admin',
        targetType: 'organisation',
        targetId: command.organisationId,
        metadata: { reason: command.reason, code: alias.code },
        result: AuditResult.SUCCESS,
      })
      .catch(() => {})

    return PayableStatusResponseDTO.fromAlias(alias)
  }
}
