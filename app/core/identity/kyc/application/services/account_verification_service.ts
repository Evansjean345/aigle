import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import type { DocumentPieceInput } from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import FileStorageService from '#shared/infrastructure/services/file_storage_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import {
  DocumentPieceType,
  KycDocumentNextAction,
  KycDocumentStatus,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import {
  SubmissionMode,
  missingPieces,
  requirementsFor,
  type SubmittedPiece,
} from '#core/identity/kyc/domain/verification_requirements'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import AccountNotFoundException from '#core/identity/account/domain/exceptions/account_not_found_exception'
import KycAlreadySubmittedException from '#core/identity/kyc/domain/exceptions/kyc_already_submitted_exception'
import IncompleteVerificationFileException from '#core/identity/kyc/domain/exceptions/incomplete_verification_file_exception'
import VerificationNotApplicableException from '#core/identity/kyc/domain/exceptions/verification_not_applicable_exception'
import UnknownPieceTypeException from '#core/identity/kyc/domain/exceptions/unknown_piece_type_exception'
import type {
  SubmitVerificationCommand,
  SubmitVerificationResult,
} from '#core/identity/kyc/application/dtos/account_verification.dto'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'

/** Dossiers déjà arbitrés ou en attente de l'être : une nouvelle pièce ne s'y ajoute pas. */
const CLOSED_TO_SUBMISSION = [KycDocumentStatus.PENDING, KycDocumentStatus.APPROVED]

/**
 * Soumission d'un dossier de vérification, quel que soit le propriétaire du compte.
 *
 * Un compte utilisateur dépose ses pièces d'identité d'un seul coup ; une organisation dépose les
 * siennes au fil de l'eau et son dossier attend d'être complet avant d'entrer dans la file de revue.
 * Le catalogue de complétude tranche les deux cas.
 */
@inject()
export default class AccountVerificationService {
  constructor(
    private readonly kycDocumentRepository: KycDocumentRepository,
    private readonly fileStorageService: FileStorageService,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Dépose des pièces au dossier d'un compte et rend l'état qui en résulte.
   *
   * @param {SubmitVerificationCommand} command - Compte visé et pièces déposées.
   * @returns {Promise<SubmitVerificationResult>} Statut du dossier, prochaine action et pièces
   *   encore attendues.
   * @throws {AccountNotFoundException} Compte inconnu.
   * @throws {VerificationNotApplicableException} Le segment du compte ne passe aucune vérification.
   * @throws {KycAlreadySubmittedException} Un dossier est déjà en revue ou approuvée.
   * @throws {UnknownPieceTypeException} Une pièce déposée n'est pas attendue par ce dossier.
   * @throws {IncompleteVerificationFileException} Lot incomplet, en mode atomique.
   */
  async submit(command: SubmitVerificationCommand): Promise<SubmitVerificationResult> {
    const account = await this.accountStandingService.describe(command.accountId)

    if (!account) throw new AccountNotFoundException()

    const requirements = requirementsFor(account.verificationProfile, command.documentType)

    if (requirements.pieces.length === 0) throw new VerificationNotApplicableException()

    this.assertPiecesAreExpected(command, requirements.pieces)

    const existing = await this.kycDocumentRepository.findByAccountId(command.accountId)

    if (existing && CLOSED_TO_SUBMISSION.includes(existing.status)) {
      throw new KycAlreadySubmittedException()
    }

    const alreadyHeld = this.heldPieces(existing)
    const incoming = command.pieces.map((piece) => ({
      pieceType: piece.pieceType,
      hasReference: Boolean(piece.reference?.trim()),
    }))

    const missing = missingPieces(account.verificationProfile, command.documentType, [
      ...alreadyHeld.filter((held) => !incoming.some((one) => one.pieceType === held.pieceType)),
      ...incoming,
    ])

    if (requirements.mode === SubmissionMode.ATOMIC && missing.length > 0) {
      throw new IncompleteVerificationFileException(missing)
    }

    const document = existing ?? new KycDocument()

    document.accountId = command.accountId
    document.ownerType = account.ownerType
    document.documentType = command.documentType
    document.comment = undefined
    document.agentId = null

    if (account.ownerType === AccountOwnerType.USER) {
      document.userId = command.accountId
    }

    const complete = missing.length === 0

    document.status = complete ? KycDocumentStatus.PENDING : KycDocumentStatus.IN_SUBMISSION
    document.nextAction = complete ? KycDocumentNextAction.IN_REVIEW : missing[0]

    const saved = await this.kycDocumentRepository.saveWithPieces(
      document,
      await this.uploadPieces(command)
    )

    if (complete) {
      await this.recordAttempt(saved, command)

      await KycDocumentSubmitted.dispatch(
        command.accountId,
        account.ownerType,
        account.ownerType === AccountOwnerType.USER ? command.accountId : null,
        KycDocumentStatus.PENDING,
        command.auditContext
      )
    }

    return {
      status: saved.status,
      nextAction: saved.nextAction as string,
      missingPieces: missing,
    }
  }

  /**
   * Vérifie que chaque pièce déposée figure au catalogue du dossier.
   *
   * @param {SubmitVerificationCommand} command - Dépôt à contrôler.
   * @param {{ pieceType: DocumentPieceType }[]} expected - Pièces que le dossier attend.
   * @throws {UnknownPieceTypeException} Une pièce déposée n'est pas attendue.
   */
  private assertPiecesAreExpected(
    command: SubmitVerificationCommand,
    expected: { pieceType: DocumentPieceType }[]
  ): void {
    for (const piece of command.pieces) {
      if (!expected.some((one) => one.pieceType === piece.pieceType)) {
        throw new UnknownPieceTypeException(piece.pieceType)
      }
    }
  }

  /**
   * Rend les pièces déjà rattachées au dossier, réduites à ce qui décide de la complétude.
   *
   * @param {KycDocument | null} document - Dossier existant, ou `null` s'il n'y en a pas encore.
   * @returns {SubmittedPiece[]} Les rôles présents et la présence de leur référence.
   */
  private heldPieces(document: KycDocument | null): SubmittedPiece[] {
    return (document?.pieces ?? []).map((piece) => ({
      pieceType: piece.pieceType,
      hasReference: Boolean(piece.reference?.trim()),
    }))
  }

  /**
   * Dépose les fichiers sur le stockage privé et en compose les pièces à écrire.
   *
   * Une référence vide n'est pas persistée : elle vaut absence.
   *
   * @param {SubmitVerificationCommand} command - Compte visé et pièces déposées.
   * @returns {Promise<DocumentPieceInput[]>} Les pièces, portant la clé de l'objet déposé.
   */
  private async uploadPieces(command: SubmitVerificationCommand): Promise<DocumentPieceInput[]> {
    const pieces: DocumentPieceInput[] = []

    for (const piece of command.pieces) {
      pieces.push({
        pieceType: piece.pieceType,
        fileKey: await this.fileStorageService.uploadPrivateFile(
          piece.file,
          `verification_pieces/${command.accountId}`
        ),
        reference: piece.reference?.trim() || undefined,
      })
    }

    return pieces
  }

  /**
   * Inscrit la soumission à l'historique du dossier, numérotée à la suite de la précédente.
   *
   * @param {KycDocument} document - Dossier devenu complet.
   * @param {SubmitVerificationCommand} command - Dépôt à l'origine de la complétude.
   * @returns {Promise<void>} Résolue quand la tentative est écrite.
   */
  private async recordAttempt(
    document: KycDocument,
    command: SubmitVerificationCommand
  ): Promise<void> {
    const last = await this.kycDocumentRepository.findLastAttempt(document.id)

    const attempt = new KycAttemp()
    attempt.kycDocumentId = document.id
    attempt.accountId = command.accountId
    attempt.userId = document.userId
    attempt.documentType = command.documentType
    attempt.attemptNumber = (last?.attemptNumber || 0) + 1
    attempt.status = KycDocumentStatus.PENDING
    attempt.agentId = null

    await this.kycDocumentRepository.saveAttempt(attempt)
  }
}
