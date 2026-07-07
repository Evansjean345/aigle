import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { type OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Port de persistance des organisations business.
 */
export default abstract class OrganisationRepository {
  /**
   * Crée et persiste une organisation.
   */
  abstract create(
    data: Partial<Organisation>,
    trx?: TransactionClientContract
  ): Promise<Organisation>

  /**
   * Compte les organisations d'un type donné possédées par un utilisateur
   * (contrainte multi-org : ≤ 1 marchand par user).
   */
  abstract countByOwnerAndType(
    ownerUserId: string,
    accountType: OrganisationAccountType,
    trx?: TransactionClientContract
  ): Promise<number>

  /**
   * Liste les organisations possédées par un utilisateur.
   */
  abstract listByOwner(ownerUserId: string): Promise<Organisation[]>
}
