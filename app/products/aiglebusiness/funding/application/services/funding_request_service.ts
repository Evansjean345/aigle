import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import FundingRequestRepository from '#aiglebusiness/funding/domain/interfaces/funding_request_repository'
import CollectionAccountRepository from '#aiglebusiness/funding/domain/interfaces/collection_account_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import FundingRequestNotFoundException from '#aiglebusiness/funding/domain/exceptions/funding_request_not_found_exception'
import FundingRequestNotCancellableException from '#aiglebusiness/funding/domain/exceptions/funding_request_not_cancellable_exception'
import CollectionAccountUnavailableException from '#aiglebusiness/funding/domain/exceptions/collection_account_unavailable_exception'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'
import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { DeclareFundingRequestCommand } from '#aiglebusiness/funding/application/dtos/funding_request.dto'

/** Préfixe du dossier de stockage des justificatifs sur le disque privé. */
const DOCUMENT_FOLDER = 'funding-requests'

/**
 * Déclarations de versement du marchand : dépôt du justificatif, consultation et annulation.
 *
 * Ne touche jamais au wallet — le crédit est du ressort du service de revue.
 */
@inject()
export default class FundingRequestService {
  constructor(
    private readonly repository: FundingRequestRepository,
    private readonly collectionAccounts: CollectionAccountRepository,
    private readonly fileStorage: FileStorageService
  ) {}

  /**
   * Enregistre la déclaration d'un versement déjà effectué et dépose son justificatif.
   *
   * Le compte de collecte visé doit exister et être actif. Le fichier est déposé avant la création
   * de la demande : si le stockage échoue, aucune demande n'est créée.
   *
   * @param {DeclareFundingRequestCommand} command - Organisation, auteur, compte de collecte visé,
   * montant déclaré et justificatif.
   * @returns {Promise<FundingRequest>} La demande créée, au statut `pending`.
   * @throws {CollectionAccountUnavailableException} Compte de collecte inexistant ou désactivé.
   */
  async declare(command: DeclareFundingRequestCommand): Promise<FundingRequest> {
    const account = await this.collectionAccounts.findByReference(
      command.collectionAccountReference
    )

    if (!account || !account.isActive) {
      throw new CollectionAccountUnavailableException()
    }

    const documentKey = await this.fileStorage.uploadPrivateFile(command.document, DOCUMENT_FOLDER)

    return this.repository.create({
      reference: this.generateReference(),
      organisationId: command.organisationId,
      declaredByUserId: command.declaredByUserId,
      collectionAccountReference: account.reference,
      declaredAmount: command.declaredAmount,
      documentKey,
      status: FundingRequestStatus.PENDING,
      cancelledAt: null,
    })
  }

  /**
   * Liste les demandes d'une organisation, les plus récentes d'abord.
   *
   * @param {string} organisationId - Organisation propriétaire des demandes.
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @returns {Promise<FundingRequest[]>} Les demandes de cette organisation uniquement.
   */
  list(organisationId: string, status?: FundingRequestStatus): Promise<FundingRequest[]> {
    return this.repository.listForOrganisation(organisationId, status)
  }

  /**
   * Récupère une demande de l'organisation.
   *
   * @param {string} organisationId - Organisation propriétaire de la demande.
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest>} La demande correspondante.
   * @throws {FundingRequestNotFoundException} Référence inconnue, ou demande appartenant à une autre
   * organisation.
   */
  get(organisationId: string, reference: string): Promise<FundingRequest> {
    return this.getOrFail(organisationId, reference)
  }

  /**
   * Annule une demande encore en attente. La demande reste en base avec le statut `cancelled`.
   *
   * @param {string} organisationId - Organisation propriétaire de la demande.
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest>} La demande annulée.
   * @throws {FundingRequestNotFoundException} Référence inconnue, ou demande d'une autre organisation.
   * @throws {FundingRequestNotCancellableException} La demande n'est plus en attente.
   */
  async cancel(organisationId: string, reference: string): Promise<FundingRequest> {
    const request = await this.getOrFail(organisationId, reference)

    if (!request.isCancellable) {
      throw new FundingRequestNotCancellableException()
    }

    request.status = FundingRequestStatus.CANCELLED
    request.cancelledAt = DateTime.now()

    return this.repository.update(request)
  }

  /**
   * Génère l'URL de consultation du justificatif. À appeler au moment de servir la réponse :
   * l'URL est signée et expire.
   *
   * @param {FundingRequest} request - Demande dont on veut le justificatif.
   * @returns {Promise<string>} URL temporaire du fichier.
   */
  documentUrl(request: FundingRequest): Promise<string> {
    return this.fileStorage.signedUrl(request.documentKey)
  }

  /**
   * Charge une demande de l'organisation ou lève.
   *
   * @param {string} organisationId - Organisation propriétaire de la demande.
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest>} La demande correspondante.
   * @throws {FundingRequestNotFoundException} Référence inconnue, ou demande d'une autre organisation.
   */
  private async getOrFail(organisationId: string, reference: string): Promise<FundingRequest> {
    const request = await this.repository.findByReferenceForOrganisation(organisationId, reference)

    if (!request) {
      throw new FundingRequestNotFoundException()
    }

    return request
  }

  /**
   * Génère la référence publique d'une demande.
   *
   * @returns {string} Une référence de la forme `funding_<12 caractères hexadécimaux>`.
   */
  private generateReference(): string {
    return `funding_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
}
