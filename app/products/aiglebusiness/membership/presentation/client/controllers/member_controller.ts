import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { AuditResult } from '#core/audit/domain/enums'
import ListMembersUseCase from '#aiglebusiness/membership/application/use_cases/members/list_members.use_case'
import InviteMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/invite_member.use_case'
import ResendInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/resend_invitation.use_case'
import ChangeMemberRoleUseCase from '#aiglebusiness/membership/application/use_cases/members/change_member_role.use_case'
import RemoveMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/remove_member.use_case'
import {
  auditDenials,
  businessActorId,
  businessTraceContext,
  emitBusinessAudit,
} from '#aiglebusiness/shared/business_audit'
import {
  inviteMemberValidator,
  changeMemberRoleValidator,
} from '#aiglebusiness/membership/presentation/client/validators/member_validators'

/**
 * Gestion des membres d'une organisation (canal client, OWNER/gestionnaire).
 * L'autorisation `members:manage` (scopée à l'org) est appliquée en amont par le
 * middleware `orgPermission` (Lot D) — les contrôleurs n'orchestrent que le flux.
 */
@inject()
export default class MemberController {
  constructor(
    private readonly listMembers: ListMembersUseCase,
    private readonly inviteMember: InviteMemberUseCase,
    private readonly resendInvitation: ResendInvitationUseCase,
    private readonly changeMemberRole: ChangeMemberRoleUseCase,
    private readonly removeMember: RemoveMemberUseCase
  ) {}

  /** Liste les membres (tous statuts). */
  async index({ params, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const result = await this.listMembers.execute(organisationId)
    return response.ok(result)
  }

  /** Invite un membre. */
  async store(ctx: HttpContext): Promise<void> {
    const { params, request, response } = ctx
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(inviteMemberValidator)
    const result = await auditDenials(
      ctx,
      {
        eventCategory: 'MEMBERSHIP',
        eventAction: 'MEMBER_INVITED',
        targetType: 'Organisation',
        targetId: organisationId,
      },
      () =>
        this.inviteMember.execute({
          organisationId,
          phone: payload.phone,
          roleId: payload.role_id,
        })
    )

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_INVITED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationMember',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      metadata: { organisationId, invitedUserId: result.userId, roleId: result.roleId },
    })

    return response.created(result)
  }

  /** Régénère et renvoie l'invitation d'un membre PENDING. */
  async resend(ctx: HttpContext): Promise<void> {
    const { params, response } = ctx
    const organisationId = params.organisationId as string
    const result = await this.resendInvitation.execute(organisationId, Number(params.memberId))

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_INVITE_RESENT',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationMember',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      metadata: { organisationId, invitedUserId: result.userId },
    })

    return response.ok(result)
  }

  /** Change le rôle d'un membre. */
  async updateRole(ctx: HttpContext): Promise<void> {
    const { params, request, response } = ctx
    const organisationId = params.organisationId as string
    const memberId = Number(params.memberId)
    const payload = await request.validateUsing(changeMemberRoleValidator)
    const result = await auditDenials(
      ctx,
      {
        eventCategory: 'MEMBERSHIP',
        eventAction: 'MEMBER_ROLE_CHANGED',
        targetType: 'OrganisationMember',
        targetId: String(memberId),
      },
      () =>
        this.changeMemberRole.execute({
          organisationId,
          memberId,
          roleId: payload.role_id,
        })
    )

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_ROLE_CHANGED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationMember',
      targetId: String(result.id),
      result: AuditResult.SUCCESS,
      newValues: { roleId: result.roleId, roleSlug: result.roleSlug },
      metadata: { organisationId, memberUserId: result.userId },
    })

    return response.ok(result)
  }

  /** Retire un membre (PENDING → supprimé, ACTIVE → REMOVED). */
  async destroy(ctx: HttpContext): Promise<void> {
    const { params, response } = ctx
    const organisationId = params.organisationId as string
    const memberId = Number(params.memberId)
    await auditDenials(
      ctx,
      {
        eventCategory: 'MEMBERSHIP',
        eventAction: 'MEMBER_REMOVED',
        targetType: 'OrganisationMember',
        targetId: String(memberId),
      },
      () => this.removeMember.execute(organisationId, memberId)
    )

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'MEMBERSHIP',
      eventAction: 'MEMBER_REMOVED',
      actorId: businessActorId(ctx),
      targetType: 'OrganisationMember',
      targetId: String(memberId),
      result: AuditResult.SUCCESS,
      metadata: { organisationId },
    })

    return response.noContent()
  }
}
