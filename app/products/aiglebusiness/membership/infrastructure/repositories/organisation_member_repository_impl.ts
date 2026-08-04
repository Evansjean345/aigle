import { type DateTime } from 'luxon'
import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import type OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { ListOrganisationMembersQuery } from '#aiglebusiness/membership/domain/types/organisation_member_repository_types'

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
    userId: string,
    trx?: TransactionClientContract
  ): Promise<OrganisationMember | null> {
    return await OrganisationMember.query({ client: trx })
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

  async countActiveByOrganisationIds(organisationIds: string[]): Promise<Map<string, number>> {
    if (organisationIds.length === 0) return new Map()

    const rows = await OrganisationMember.query()
      .whereIn('organisation_id', organisationIds)
      .where('status', MemberStatus.ACTIVE)
      .groupBy('organisation_id')
      .select('organisation_id')
      .count('* as total')

    return new Map(rows.map((row) => [row.organisationId, Number(row.$extras.total)]))
  }

  async countActiveByRoleIds(roleIds: number[]): Promise<Map<number, number>> {
    if (roleIds.length === 0) return new Map()

    const rows = await OrganisationMember.query()
      .whereIn('role_id', roleIds)
      .where('status', MemberStatus.ACTIVE)
      .groupBy('role_id')
      .select('role_id')
      .count('* as total')

    return new Map(rows.map((row) => [row.roleId, Number(row.$extras.total)]))
  }

  async listPaginatedByOrganisation(
    organisationId: string,
    query: ListOrganisationMembersQuery
  ): Promise<ModelPaginatorContract<OrganisationMember>> {
    const builder = OrganisationMember.query()
      .where('organisation_id', organisationId)
      .preload('role')

    if (query.status) builder.where('status', query.status)

    // Un tableau vide est un filtre, pas une absence de filtre : il signifie « aucune
    // correspondance » et doit rendre une page vide.
    if (query.userIds !== undefined) builder.whereIn('user_id', query.userIds)

    return builder.orderBy('created_at', 'asc').paginate(query.page, query.perPage)
  }

  async listUserIdsByOrganisation(organisationId: string): Promise<string[]> {
    const rows = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .distinct('user_id')
      .select('user_id')

    return rows.map((row) => row.userId)
  }

  async countByStatus(organisationId: string): Promise<Map<MemberStatus, number>> {
    const rows = await OrganisationMember.query()
      .where('organisation_id', organisationId)
      .groupBy('status')
      .select('status')
      .count('* as total')

    return new Map(rows.map((row) => [row.status, Number(row.$extras.total)]))
  }
}
