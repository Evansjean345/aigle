import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type FundingRequestRepository from '#aiglebusiness/funding/domain/interfaces/funding_request_repository'
import type { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/** Persistance Lucid des demandes de réapprovisionnement. */
export default class FundingRequestRepositoryImpl implements FundingRequestRepository {
  /**
   * Crée une demande.
   *
   * @param {Partial<FundingRequest>} data - Champs de la demande à persister.
   * @returns {Promise<FundingRequest>} La demande créée.
   */
  async create(data: Partial<FundingRequest>): Promise<FundingRequest> {
    const request = new FundingRequest()
    request.merge(data)
    return request.save()
  }

  /**
   * Retrouve une demande appartenant à une organisation donnée.
   *
   * L'organisation fait partie du critère de recherche : une demande d'une autre organisation ne
   * remonte jamais.
   *
   * @param {string} organisationId - Organisation propriétaire.
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest | null>} La demande, ou `null` si elle n'existe pas ou
   * appartient à une autre organisation.
   */
  async findByReferenceForOrganisation(
    organisationId: string,
    reference: string
  ): Promise<FundingRequest | null> {
    return FundingRequest.query()
      .where('organisation_id', organisationId)
      .where('reference', reference)
      .first()
  }

  /**
   * Liste les demandes d'une organisation, les plus récentes d'abord.
   *
   * @param {string} organisationId - Organisation propriétaire.
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @returns {Promise<FundingRequest[]>} Les demandes de cette organisation.
   */
  async listForOrganisation(
    organisationId: string,
    status?: FundingRequestStatus
  ): Promise<FundingRequest[]> {
    const query = FundingRequest.query().where('organisation_id', organisationId)

    if (status) query.where('status', status)

    return query.orderBy('created_at', 'desc')
  }

  /**
   * Persiste les modifications d'une demande.
   *
   * @param {FundingRequest} request - Demande à sauvegarder.
   * @param {TransactionClientContract} [trx] - Transaction à utiliser.
   * @returns {Promise<FundingRequest>} La demande sauvegardée.
   */
  async update(request: FundingRequest, trx?: TransactionClientContract): Promise<FundingRequest> {
    if (trx) return request.useTransaction(trx).save()
    return request.save()
  }

  /**
   * Liste les demandes de toutes les organisations, les plus anciennes d'abord.
   *
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @param organisationId
   * @returns {Promise<FundingRequest[]>} Les demandes correspondantes.
   */
  async listForReview(
    status?: FundingRequestStatus,
    organisationId?: string
  ): Promise<FundingRequest[]> {
    const query = FundingRequest.query()

    if (status) query.where('status', status)
    if (organisationId) query.where('organisation_id', organisationId)

    return query.orderBy('created_at', 'desc')
  }

  /**
   * Retrouve une demande par sa référence, sans filtre d'organisation.
   *
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest | null>} La demande, ou `null` si la référence est inconnue.
   */
  async findByReference(reference: string): Promise<FundingRequest | null> {
    return FundingRequest.query().where('reference', reference).first()
  }

  /**
   * Charge une demande sous verrou exclusif (`SELECT … FOR UPDATE`).
   *
   * @param {string} reference - Référence de la demande.
   * @param {TransactionClientContract} trx - Transaction dans laquelle poser le verrou.
   * @returns {Promise<FundingRequest | null>} La demande verrouillée, ou `null` si la référence est
   * inconnue.
   */
  async lockByReference(
    reference: string,
    trx: TransactionClientContract
  ): Promise<FundingRequest | null> {
    return FundingRequest.query({ client: trx }).where('reference', reference).forUpdate().first()
  }
}
