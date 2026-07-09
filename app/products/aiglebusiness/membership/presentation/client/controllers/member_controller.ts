import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListMembersUseCase from '#aiglebusiness/membership/application/use_cases/members/list_members.use_case'
import InviteMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/invite_member.use_case'
import ResendInvitationUseCase from '#aiglebusiness/membership/application/use_cases/members/resend_invitation.use_case'
import ChangeMemberRoleUseCase from '#aiglebusiness/membership/application/use_cases/members/change_member_role.use_case'
import RemoveMemberUseCase from '#aiglebusiness/membership/application/use_cases/members/remove_member.use_case'
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
  async store({ params, request, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(inviteMemberValidator)
    const result = await this.inviteMember.execute({
      organisationId,
      phone: payload.phone,
      roleId: payload.role_id,
    })

    return response.created(result)
  }

  /** Régénère et renvoie l'invitation d'un membre PENDING. */
  async resend({ params, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const result = await this.resendInvitation.execute(organisationId, Number(params.memberId))
    return response.ok(result)
  }

  /** Change le rôle d'un membre. */
  async updateRole({ params, request, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    const payload = await request.validateUsing(changeMemberRoleValidator)
    const result = await this.changeMemberRole.execute({
      organisationId,
      memberId: Number(params.memberId),
      roleId: payload.role_id,
    })

    return response.ok(result)
  }

  /** Retire un membre (PENDING → supprimé, ACTIVE → REMOVED). */
  async destroy({ params, response }: HttpContext): Promise<void> {
    const organisationId = params.organisationId as string
    await this.removeMember.execute(organisationId, Number(params.memberId))
    return response.noContent()
  }
}
