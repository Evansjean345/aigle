import OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import type OrganisationMemberRepository from '#aiglebusiness/membership/domain/interfaces/organisation_member_repository'
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
}
