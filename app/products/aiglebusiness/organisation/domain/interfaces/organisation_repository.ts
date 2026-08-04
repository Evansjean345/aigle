import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { type OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type {
  ListOrganisationsQuery,
  OrganisationStatsCounts,
} from '#aiglebusiness/organisation/domain/types/organisation_repository_types'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

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

  /** Compte les organisations possédées par un utilisateur, tous types confondus. */
  abstract countByOwner(ownerUserId: string, trx?: TransactionClientContract): Promise<number>

  /**
   * Liste les organisations par identifiants publics (uuid), triées par date de
   * création décroissante. Renvoie `[]` pour une liste d'ids vide.
   */
  abstract listByIds(organisationIds: string[]): Promise<Organisation[]>

  /**
   * Retrouve une organisation par son identifiant public (uuid).
   */
  abstract findByOrganisationId(organisationId: string): Promise<Organisation | null>

  /**
   * Liste paginée de **toutes** les organisations, les plus récentes d'abord.
   *
   * @param {ListOrganisationsQuery} query - Filtres et pagination, déjà normalisés.
   * @returns {Promise<ModelPaginatorContract<Organisation>>} La page demandée et son compteur total.
   */
  abstract listPaginated(
    query: ListOrganisationsQuery
  ): Promise<ModelPaginatorContract<Organisation>>

  /**
   * Recherche une organisation par nom ou code payable, pour un champ d'autocomplétion.
   *
   * @param {string} term - Fragment recherché.
   * @param {number} limit - Nombre maximal de résultats.
   * @returns {Promise<Organisation[]>} Les correspondances, `[]` si le terme est vide.
   */
  abstract searchByTerm(term: string, limit: number): Promise<Organisation[]>

  /**
   * Liste les organisations dont la configuration traîne, les plus anciennes d'abord.
   *
   * @param {number} olderThanMinutes - Âge minimal, pour ne pas reprendre une création en cours.
   * @param {number} limit - Nombre maximal d'organisations rendues.
   * @returns {Promise<Organisation[]>} Les organisations en `PROVISIONING` dépassant ce délai.
   */
  abstract findStaleProvisioning(olderThanMinutes: number, limit: number): Promise<Organisation[]>

  /**
   * Attache le code d'encaissement à une organisation.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @param {string} payableCode - Code de l'alias d'encaissement.
   * @param {TransactionClientContract} [trx] - Transaction englobante.
   * @returns {Promise<Organisation>} L'organisation mise à jour.
   */
  abstract attachPayableCode(
    organisationId: string,
    payableCode: string,
    trx?: TransactionClientContract
  ): Promise<Organisation>

  /**
   * Fixe le statut de cycle de vie d'une organisation.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @param {OrganisationStatus} status - Nouveau statut.
   * @param {TransactionClientContract} [trx] - Transaction englobante.
   * @returns {Promise<Organisation>} L'organisation dans son nouvel état.
   */
  abstract updateStatus(
    organisationId: string,
    status: OrganisationStatus,
    trx?: TransactionClientContract
  ): Promise<Organisation>

  /**
   * Compte les organisations par statut, par type et sur la journée, pour le bandeau admin.
   *
   *
   * @returns {Promise<OrganisationStatsCounts>} Les six compteurs, à zéro sur une base vide.
   */
  abstract countStats(): Promise<OrganisationStatsCounts>
}
