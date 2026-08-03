import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import FundingRequestRepository from '#aiglebusiness/funding/domain/interfaces/funding_request_repository'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'
import FundingRequestNotFoundException from '#aiglebusiness/funding/domain/exceptions/funding_request_not_found_exception'
import FundingRequestNotReviewableException from '#aiglebusiness/funding/domain/exceptions/funding_request_not_reviewable_exception'
import VerifiedAmountExceedsDeclaredException from '#aiglebusiness/funding/domain/exceptions/verified_amount_exceeds_declared_exception'
import InvalidReviewCommentException from '#aiglebusiness/funding/domain/exceptions/invalid_review_comment_exception'
import InvalidVerifiedAmountException from '#aiglebusiness/funding/domain/exceptions/invalid_verified_amount_exception'
import FundingCreditFailedException from '#aiglebusiness/funding/domain/exceptions/funding_credit_failed_exception'
import FundingThresholdNotConfiguredException from '#aiglebusiness/funding/domain/exceptions/funding_threshold_not_configured_exception'
import SecondApprovalSameAdminException from '#aiglebusiness/funding/domain/exceptions/second_approval_same_admin_exception'
import FundingRequestNotAwaitingConfirmationException from '#aiglebusiness/funding/domain/exceptions/funding_request_not_awaiting_confirmation_exception'
import FundingSettingsRepository from '#aiglebusiness/funding/domain/interfaces/funding_settings_repository'
import type {
  ApproveFundingRequestCommand,
  ConfirmFundingRequestCommand,
  RejectFundingRequestCommand,
} from '#aiglebusiness/funding/application/dtos/funding_request.dto'

/**
 * Traitement des demandes de réapprovisionnement par un gestionnaire : validation avec crédit du
 * wallet, ou rejet motivé.
 */
@inject()
export default class FundingRequestReviewService {
  constructor(
    private readonly repository: FundingRequestRepository,
    private readonly settingsRepository: FundingSettingsRepository,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Liste les demandes de toutes les organisations, les plus anciennes d'abord.
   *
   * @param {FundingRequestStatus} [status] - Filtre optionnel sur le statut.
   * @param {string} [organisationId] - Restreint à une organisation, pour l'onglet de sa fiche.
   * @returns {Promise<FundingRequest[]>} Les demandes correspondantes.
   */
  listForReview(status?: FundingRequestStatus, organisationId?: string): Promise<FundingRequest[]> {
    return this.repository.listForReview(status, organisationId)
  }

  /**
   * Récupère une demande par sa référence, sans filtre d'organisation.
   *
   * @param {string} reference - Référence de la demande.
   * @returns {Promise<FundingRequest>} La demande correspondante.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   */
  async getForReview(reference: string): Promise<FundingRequest> {
    const request = await this.repository.findByReference(reference)

    if (!request) {
      throw new FundingRequestNotFoundException()
    }

    return request
  }

  /**
   * Valide la demande et crédite le wallet de l'organisation du montant vérifié.
   *
   * Le crédit, la ligne ledger et le changement de statut sont écrits dans une seule transaction.
   * Le montant vérifié ne peut pas dépasser le montant déclaré par le marchand.
   *
   * @param {ApproveFundingRequestCommand} command - Référence de la demande, montant constaté,
   * identifiant du gestionnaire et commentaire optionnel.
   * @returns {Promise<FundingRequest>} La demande au statut `approved`, avec le montant vérifié et
   * l'auteur de la décision.
   * @throws {InvalidVerifiedAmountException} Montant nul ou négatif.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   * @throws {FundingRequestNotReviewableException} Demande déjà traitée.
   * @throws {VerifiedAmountExceedsDeclaredException} Montant supérieur au montant déclaré.
   * @throws {FundingThresholdNotConfiguredException} Le seuil de double validation est absent.
   * @throws {WalletNotFoundException} L'organisation n'a pas de wallet.
   * @throws {FundingCreditFailedException} Le crédit n'a pas pu être appliqué.
   */
  async approve(command: ApproveFundingRequestCommand): Promise<FundingRequest> {
    if (!Number.isInteger(command.verifiedAmount) || command.verifiedAmount <= 0) {
      throw new InvalidVerifiedAmountException()
    }

    const comment = command.comment?.trim()

    if (!comment) {
      throw new InvalidReviewCommentException()
    }

    const threshold = await this.resolveThreshold()
    const trx = await db.transaction()

    try {
      const request = await this.lockForReview(command.reference, trx)

      if (command.verifiedAmount > Number(request.declaredAmount)) {
        throw new VerifiedAmountExceedsDeclaredException(
          command.verifiedAmount,
          Number(request.declaredAmount)
        )
      }

      request.verifiedAmount = command.verifiedAmount
      request.approvalThresholdApplied = threshold

      // Le seuil se compare au montant DÉCLARÉ par le marchand, jamais au montant saisi par le
      // valideur : sinon il suffirait de saisir sous le seuil pour se passer du second regard.
      if (Number(request.declaredAmount) > threshold) {
        request.status = FundingRequestStatus.PENDING_SECOND_APPROVAL
        request.firstApprovedByAdminId = command.adminId
        request.firstApprovedAt = DateTime.now()
        // Le commentaire appartient au premier valideur ; celui qui clôt écrira dans son propre champ.
        request.firstApprovalComment = comment

        await this.repository.update(request, trx)
        await trx.commit()

        return request
      }

      // Un seul valideur : son commentaire est celui de la décision finale.
      request.reviewComment = comment

      await this.creditAndClose(request, command.adminId, trx)
      await trx.commit()

      return request
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Confirme une demande pré-approuvée et déclenche le crédit.
   *
   * Le montant n'est pas repris : le second gestionnaire contrôle le constat du premier, il ne le
   * corrige pas. S'il le juge faux, il rejette.
   *
   * @param {ConfirmFundingRequestCommand} command - Référence de la demande et identifiant du second
   * gestionnaire.
   * @returns {Promise<FundingRequest>} La demande au statut `approved`.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   * @throws {FundingRequestNotAwaitingConfirmationException} La demande n'attend pas de confirmation.
   * @throws {SecondApprovalSameAdminException} Le confirmateur est le premier valideur.
   * @throws {WalletNotFoundException} L'organisation n'a pas de wallet.
   * @throws {FundingCreditFailedException} Le crédit n'a pas pu être appliqué.
   */
  async confirm(command: ConfirmFundingRequestCommand): Promise<FundingRequest> {
    const comment = command.comment?.trim()

    if (!comment) {
      throw new InvalidReviewCommentException()
    }

    const trx = await db.transaction()

    try {
      const request = await this.repository.lockByReference(command.reference, trx)

      if (!request) {
        throw new FundingRequestNotFoundException()
      }

      if (!request.awaitsSecondApproval) {
        throw new FundingRequestNotAwaitingConfirmationException()
      }

      if (request.firstApprovedByAdminId === command.adminId) {
        throw new SecondApprovalSameAdminException()
      }

      request.reviewComment = comment

      await this.creditAndClose(request, command.adminId, trx)
      await trx.commit()

      return request
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Refuse la demande avec un motif obligatoire. Ne touche pas au wallet.
   *
   * @param {RejectFundingRequestCommand} command - Référence de la demande, identifiant du
   * gestionnaire et motif du refus.
   * @returns {Promise<FundingRequest>} La demande au statut `rejected'.
   * @throws {InvalidReviewCommentException} Motif vide ou composé d'espaces.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   * @throws {FundingRequestNotReviewableException} Demande déjà traitée.
   */
  async reject(command: RejectFundingRequestCommand): Promise<FundingRequest> {
    const comment = command.comment?.trim()

    if (!comment) {
      throw new InvalidReviewCommentException()
    }

    const trx = await db.transaction()

    try {
      const request = await this.lockForRejection(command.reference, trx)

      request.status = FundingRequestStatus.REJECTED
      request.reviewedByAdminId = command.adminId
      request.reviewedAt = DateTime.now()
      request.reviewComment = comment

      await this.repository.update(request, trx)
      await trx.commit()

      return request
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Crédite le wallet du montant vérifié et clôt la demande.
   *
   * Partagé par la validation simple et la confirmation : le crédit doit être identique dans les deux
   * cas. Attend une demande déjà verrouillée et un `verifiedAmount` renseigné.
   *
   * @param {FundingRequest} request - Demande verrouillée à créditer.
   * @param {number} adminId - Gestionnaire qui clôt le dossier.
   * @param {TransactionClientContract} trx - Transaction en cours.
   * @returns {Promise<void>} Rien.
   * @throws {WalletNotFoundException} L'organisation n'a pas de wallet.
   * @throws {FundingCreditFailedException} Le crédit n'a pas pu être appliqué.
   */
  private async creditAndClose(
    request: FundingRequest,
    adminId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    const amount = Number(request.verifiedAmount)
    const wallet = await this.walletService.getByAccountId(request.organisationId, trx)
    const balanceBefore = Number(wallet.balance)

    const credited = await this.walletService.creditBalance(wallet.id, amount, trx)

    if (!credited) {
      throw new FundingCreditFailedException()
    }

    await this.ledgerService.recordFundingCredit(
      {
        walletId: wallet.id,
        amount,
        balanceBefore,
        balanceAfter: credited.balance,
        reference: request.reference,
      },
      trx
    )

    request.status = FundingRequestStatus.APPROVED
    request.reviewedByAdminId = adminId
    request.reviewedAt = DateTime.now()

    await this.repository.update(request, trx)
  }

  /**
   * Résout le seuil de double validation applicable.
   *
   * Point d'extension unique : la surcharge par organisation viendra s'insérer ici, en amont du
   * défaut global.
   *
   * @returns {Promise<number>} Le seuil applicable.
   * @throws {FundingThresholdNotConfiguredException} Aucun seuil n'est configuré.
   */
  private async resolveThreshold(): Promise<number> {
    const settings = await this.settingsRepository.find()

    if (!settings) {
      throw new FundingThresholdNotConfiguredException()
    }

    return Number(settings.doubleApprovalThreshold)
  }

  /**
   * Charge la demande sous verrou exclusif et vérifie qu'elle est encore en attente.
   *
   * Le verrou empêche deux gestionnaires de traiter la même demande simultanément.
   *
   * @param {string} reference - Référence de la demande.
   * @param {TransactionClientContract} trx - Transaction dans laquelle poser le verrou.
   * @returns {Promise<FundingRequest>} La demande verrouillée, au statut `pending'.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   * @throws {FundingRequestNotReviewableException} Demande déjà traitée.
   */
  private async lockForReview(
    reference: string,
    trx: TransactionClientContract
  ): Promise<FundingRequest> {
    const request = await this.repository.lockByReference(reference, trx)

    if (!request) {
      throw new FundingRequestNotFoundException()
    }

    if (!request.isReviewable) {
      throw new FundingRequestNotReviewableException()
    }

    return request
  }

  /**
   * Charge la demande sous verrou exclusif et vérifie qu'elle peut encore être refusée.
   *
   * Plus permissif que `lockForReview` : un rejet reste possible après une première approbation,
   * c'est précisément le sens du second regard.
   *
   * @param {string} reference - Référence de la demande.
   * @param {TransactionClientContract} trx - Transaction dans laquelle poser le verrou.
   * @returns {Promise<FundingRequest>} La demande verrouillée.
   * @throws {FundingRequestNotFoundException} Référence inconnue.
   * @throws {FundingRequestNotReviewableException} Demande déjà close.
   */
  private async lockForRejection(
    reference: string,
    trx: TransactionClientContract
  ): Promise<FundingRequest> {
    const request = await this.repository.lockByReference(reference, trx)

    if (!request) {
      throw new FundingRequestNotFoundException()
    }

    if (!request.isRejectable) {
      throw new FundingRequestNotReviewableException()
    }

    return request
  }
}
