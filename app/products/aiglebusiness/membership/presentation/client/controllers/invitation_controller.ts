import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { AuditResult } from '#core/audit/domain/enums'
import GetInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/get_invitation.use_case'
import AcceptInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/accept_invitation.use_case'
import DeclineInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/decline_invitation.use_case'
import { businessTraceContext, emitBusinessAudit } from '#aiglebusiness/shared/business_audit'
import { acceptInvitationValidator } from '#aiglebusiness/membership/presentation/client/validators/member_validators'

/**
 * Acceptation d'invitation par l'invité (semi-public : le token du lien fait foi,
 * l'OTP est le 2e facteur). Aucun auth requis — divulgation minimale (décision #15).
 */
@inject()
export default class InvitationController {
  constructor(
    private readonly getInvitation: GetInvitationUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
    private readonly declineInvitation: DeclineInvitationUseCase
  ) {}

  /** Ouvre l'invitation : envoie l'OTP, renvoie {organisationName, phoneMasked}. */
  async show({ params, response }: HttpContext): Promise<void> {
    const result = await this.getInvitation.execute(params.token as string)
    return response.ok(result)
  }

  /** Accepte l'invitation avec l'OTP → membre ACTIVE. */
  async accept(ctx: HttpContext): Promise<void> {
    const { params, request, response } = ctx
    const payload = await request.validateUsing(acceptInvitationValidator)
    const result = await this.acceptInvitation.execute(params.token as string, payload.otp)

    // Acteur = l'invité lui-même (flux semi-public, pas de token d'auth).
    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_ACCEPTED',
      actorId: result.userId,
      targetType: 'OrganisationMember',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      metadata: { roleId: result.roleId },
    })

    return response.ok(result)
  }

  /** Refuse l'invitation. */
  async decline(ctx: HttpContext): Promise<void> {
    const { params, response } = ctx
    const result = await this.declineInvitation.execute(params.token as string)

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_DECLINED',
      actorId: result.userId,
      targetType: 'OrganisationMember',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      metadata: { organisationId: result.organisationId },
    })

    return response.noContent()
  }
}
