import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Port de persistance des demandes de réapprovisionnement.
 *
 * Ne propose aucune suppression : une demande retirée passe au statut `cancelled` et reste en base.
 */
export default abstract class FundingRequestRepository {
  /**
   * Crée une demande.
   *
   * @param {Partial<FundingRequest>} data - Champs de la demande à persister.
   * @returns {Promise<FundingRequest>} La demande créée.
   */
  abstract create(data: Partial<FundingRequest>): Promise<FundingRequest>

  /**
   * Retrouve une demande appartenant à une organisation donnée.
   *
   * @param {string} organisationId - Organisation propriétaire.
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest | null>} La demande, ou `null` si elle n'existe pas ou
   * appartient à une autre organisation.
   */
  abstract findByReferenceForOrganisation(
    organisationId: string,
    reference: string
  ): Promise<FundingRequest | null>

  /**
   * Liste les demandes d'une organisation, les plus récentes d'abord.
   *
   * @param {string} organisationId - Organisation propriétaire.
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @returns {Promise<FundingRequest[]>} Les demandes de cette organisation.
   */
  abstract listForOrganisation(
    organisationId: string,
    status?: FundingRequestStatus
  ): Promise<FundingRequest[]>

  /**
   * Persiste les modifications d'une demande.
   *
   * @param {FundingRequest} request - Demande à sauvegarder.
   * @param {TransactionClientContract} [trx] - Transaction à utiliser, obligatoire si l'écriture
   * accompagne un mouvement d'argent.
   * @returns {Promise<FundingRequest>} La demande sauvegardée.
   */
  abstract update(request: FundingRequest, trx?: TransactionClientContract): Promise<FundingRequest>

  /**
   * Liste les demandes de toutes les organisations, les plus anciennes d'abord.
   *
   * Réservé au back-office : aucun cloisonnement par organisation.
   *
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @param {string} [organisationId] - Restreint à une organisation, pour l'onglet de sa fiche.
   * @returns {Promise<FundingRequest[]>} Les demandes correspondantes.
   */
  abstract listForReview(
    status?: FundingRequestStatus,
    organisationId?: string
  ): Promise<FundingRequest[]>

  /**
   * Retrouve une demande par sa référence, sans filtre d'organisation. Réservé au back-office.
   *
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest | null>} La demande, ou `null` si la référence est inconnue.
   */
  abstract findByReference(reference: string): Promise<FundingRequest | null>

  /**
   * Charge une demande sous verrou exclusif (`SELECT … FOR UPDATE`).
   *
   * Empêche deux gestionnaires de traiter la même demande simultanément. La transaction est
   * obligatoire : un verrou posé hors transaction est sans effet.
   *
   * @param {string} reference - Référence de la demande.
   * @param {TransactionClientContract} trx - Transaction dans laquelle poser le verrou.
   * @returns {Promise<FundingRequest | null>} La demande verrouillée, ou `null` si la référence est
   * inconnue.
   */
  abstract lockByReference(
    reference: string,
    trx: TransactionClientContract
  ): Promise<FundingRequest | null>
}
