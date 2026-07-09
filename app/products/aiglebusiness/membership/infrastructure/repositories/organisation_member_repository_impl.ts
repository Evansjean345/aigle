import { type DateTime } from 'luxon'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import type OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Implémentation Lucid du port OrganisationMemberRepository.
 */
export default class OrganisationMemberRepositoryImpl implements OrganisationMemberRepository {
  async create(
    data: Partial<OrganisationMember>,
    trx?: TransactionClientContract
  ): Promise<OrganisationMember> {
    const member = new OrganisationMember()
    Object.assign(member, data)

    if (trx) {
      return await member.useTransaction(trx).save()
    }

    return await member.save()
  }

  async findById(id: number): Promise<OrganisationMember | null> {
    return await OrganisationMember.query().where('id', id).preload('role').first()
  }

  async findByOrganisationAndUser(
    organisationId: string,
    userId: string
  ): Promise<OrganisationMember | null> {
    return await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .where('user_id', userId)
      .preload('role')
      .first()
  }

  async findByInvitationToken(token: string): Promise<OrganisationMember | null> {
    return await OrganisationMember.query().where('invitation_token', token).preload('role').first()
  }

  async listByOrganisation(organisationId: string): Promise<OrganisationMember[]> {
    return OrganisationMember.query()
      .where('organisation_id', organisationId)
      .preload('role')
      .orderBy('created_at', 'asc')
  }

  async listActiveByUser(userId: string): Promise<OrganisationMember[]> {
    return OrganisationMember.query()
      .where('user_id', userId)
      .where('status', MemberStatus.ACTIVE)
      .preload('role', (roleQuery) => roleQuery.preload('permissions'))
      .orderBy('created_at', 'desc')
  }

  async updateStatus(
    memberId: number,
    status: MemberStatus,
    clearInvitation: boolean = false,
    trx?: TransactionClientContract
  ): Promise<void> {
    const payload: Record<string, unknown> = { status }

    if (clearInvitation) {
      payload.invitation_token = null
      payload.invitation_expires_at = null
    }

    await OrganisationMember.query({ client: trx }).where('id', memberId).update(payload)
  }

  async updateRole(
    memberId: number,
    roleId: number,
    trx?: TransactionClientContract
  ): Promise<void> {
    await OrganisationMember.query({ client: trx })
      .where('id', memberId)
      .update({ role_id: roleId })
  }

  async setInvitation(
    memberId: number,
    roleId: number,
    token: string,
    expiresAt: DateTime,
    trx?: TransactionClientContract
  ): Promise<void> {
    await OrganisationMember.query({ client: trx })
      .where('id', memberId)
      .update({
        role_id: roleId,
        status: MemberStatus.PENDING,
        invitation_token: token,
        // Sans offset : la colonne timestamp MySQL rejette le suffixe '+00:00'.
        invitation_expires_at: expiresAt.toSQL({ includeOffset: false }),
      })
  }

  async delete(memberId: number, trx?: TransactionClientContract): Promise<void> {
    await OrganisationMember.query({ client: trx }).where('id', memberId).delete()
  }

  async countActiveByRole(roleId: number): Promise<number> {
    const result = await OrganisationMember.query()
      .where('role_id', roleId)
      .where('status', MemberStatus.ACTIVE)
      .count('* as total')
      .first()
    return Number(result?.$extras.total ?? 0)
  }
}
