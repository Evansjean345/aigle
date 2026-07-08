import type OrganisationMember from '#aiglebusiness/membership/domain/models/organisation_member'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des membres d'organisation.
 */
export default abstract class OrganisationMemberRepository {
  /**
   * Crée un membre.
   */
  abstract create(
    data: Partial<OrganisationMember>,
    trx?: TransactionClientContract
  ): Promise<OrganisationMember>
}