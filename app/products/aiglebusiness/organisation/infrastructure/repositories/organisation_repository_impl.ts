import { type OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type {
  ListOrganisationsQuery,
  OrganisationStatsCounts,
} from '#aiglebusiness/organisation/domain/types/organisation_repository_types'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { organisationSortColumn } from '#aiglebusiness/organisation/domain/types/organisation_sorts'

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

  async countByOwner(ownerUserId: string, trx?: TransactionClientContract): Promise<number> {
    const result = await Organisation.query({ client: trx })
      .where('owner_user_id', ownerUserId)
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

  async listPaginated(
    query: ListOrganisationsQuery
  ): Promise<ModelPaginatorContract<Organisation>> {
    const builder = Organisation.query()

    if (query.accountType) builder.where('account_type', query.accountType)
    if (query.level) builder.where('level', query.level)
    if (query.status) builder.where('status', query.status)
    if (query.startDate) builder.where('created_at', '>=', query.startDate)
    if (query.endDate) builder.where('created_at', '<=', `${query.endDate} 23:59:59`)

    if (query.search) {
      const term = `%${query.search}%`
      builder.where((group) => {
        group
          .whereILike('name', term)
          .orWhereILike('payable_code', term)
          .orWhereILike('organisation_id', term)
      })
    }

    const sortColumn = organisationSortColumn(query.sortBy)

    if (sortColumn) {
      builder.orderBy(sortColumn, query.order ?? 'desc')
    } else {
      builder.orderBy('created_at', 'desc')
    }

    return builder.paginate(query.page, query.perPage)
  }

  async searchByTerm(term: string, limit: number): Promise<Organisation[]> {
    const needle = term.trim()
    if (needle.length === 0) return []

    return Organisation.query()
      .where((group) => {
        group.whereILike('name', `%${needle}%`).orWhereILike('payable_code', `%${needle}%`)
      })
      .orderBy('name', 'asc')
      .limit(limit)
  }

  async findStaleProvisioning(olderThanMinutes: number, limit: number): Promise<Organisation[]> {
    const threshold = DateTime.now().minus({ minutes: olderThanMinutes }).toSQL({
      includeOffset: false,
    })

    return Organisation.query()
      .where('status', OrganisationStatus.PROVISIONING)
      .where('created_at', '<=', threshold!)
      .orderBy('created_at', 'asc')
      .limit(limit)
  }

  async attachPayableCode(
    organisationId: string,
    payableCode: string,
    trx?: TransactionClientContract
  ): Promise<Organisation> {
    const organisation = await Organisation.query({ client: trx })
      .where('organisation_id', organisationId)
      .firstOrFail()

    organisation.payableCode = payableCode

    if (trx) {
      return organisation.useTransaction(trx).save()
    }

    return organisation.save()
  }

  /**
   * Fixe le niveau d'une organisation.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @param {OrganisationLevel} level - Nouveau niveau.
   * @returns {Promise<Organisation>} L'organisation dans son nouvel état.
   */
  async updateLevel(organisationId: string, level: OrganisationLevel): Promise<Organisation> {
    const organisation = await Organisation.query()
      .where('organisation_id', organisationId)
      .firstOrFail()

    organisation.level = level

    return organisation.save()
  }

  async updateStatus(
    organisationId: string,
    status: OrganisationStatus,
    trx?: TransactionClientContract
  ): Promise<Organisation> {
    const organisation = await Organisation.query({ client: trx })
      .where('organisation_id', organisationId)
      .firstOrFail()

    organisation.status = status

    if (trx) {
      return organisation.useTransaction(trx).save()
    }

    return organisation.save()
  }

  /** Les six compteurs sont agrégés en une seule requête, pour qu'ils décrivent le même instant. */
  async countStats(): Promise<OrganisationStatsCounts> {
    const today = DateTime.now().toISODate()

    const row = await db
      .from(Organisation.table)
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active', [
          OrganisationStatus.ACTIVE,
        ]),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as inactive', [
          OrganisationStatus.INACTIVE,
        ]),
        db.raw('SUM(CASE WHEN account_type = ? THEN 1 ELSE 0 END) as merchants', [
          OrganisationAccountType.MARCHAND,
        ]),
        db.raw('SUM(CASE WHEN account_type = ? THEN 1 ELSE 0 END) as enterprises', [
          OrganisationAccountType.ENTERPRISE,
        ]),
        db.raw('SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) as createdToday', [today])
      )
      .first()

    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      merchants: Number(row?.merchants ?? 0),
      enterprises: Number(row?.enterprises ?? 0),
      createdToday: Number(row?.createdToday ?? 0),
    }
  }
}
