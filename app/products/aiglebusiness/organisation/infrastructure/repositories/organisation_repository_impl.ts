import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { type OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Implémentation Lucid du port OrganisationRepository.
 */
export default class OrganisationRepositoryImpl implements OrganisationRepository {
  async create(
    data: Partial<Organisation>,
    trx?: TransactionClientContract
  ): Promise<Organisation> {
    const organisation = new Organisation()
    Object.assign(organisation, data)

    if (trx) {
      return await organisation.useTransaction(trx).save()
    }

    return await organisation.save()
  }

  async countByOwnerAndType(
    ownerUserId: string,
    accountType: OrganisationAccountType,
    trx?: TransactionClientContract
  ): Promise<number> {
    const result = await Organisation.query({ client: trx })
      .where('owner_user_id', ownerUserId)
      .where('account_type', accountType)
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  async listByIds(organisationIds: string[]): Promise<Organisation[]> {
    if (organisationIds.length === 0) {
      return []
    }

    return Organisation.query()
      .whereIn('organisation_id', organisationIds)
      .orderBy('created_at', 'desc')
  }

  async findByOrganisationId(organisationId: string): Promise<Organisation | null> {
    return Organisation.query().where('organisation_id', organisationId).first()
  }
}
