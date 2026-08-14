import { randomUUID } from 'node:crypto'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_document_repository_impl'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

const repository = new KycDocumentRepositoryImpl()

export interface SeedKycDocumentOptions {
  /** Compte porteur. Un compte est tiré au hasard s'il n'est pas fourni. */
  accountId?: string
  ownerType?: AccountOwnerType
  status?: KycDocumentStatus
}

/**
 * Dossier de vérification en attente, muni d'une pièce recto.
 *
 * Le type de document n'est posé que sur un dossier d'identité : un dossier d'organisation n'en
 * porte pas.
 *
 * @param {SeedKycDocumentOptions} [options] - Compte, nature du dossier et statut.
 * @returns {Promise<KycDocument>} Le dossier écrit, avec sa pièce.
 */
export async function seedKycDocument(options: SeedKycDocumentOptions = {}): Promise<KycDocument> {
  const accountId = options.accountId ?? randomUUID()
  const ownerType = options.ownerType ?? AccountOwnerType.USER

  const document = new KycDocument()
  document.accountId = accountId
  document.ownerType = ownerType
  document.documentType = ownerType === AccountOwnerType.USER ? KycDocumentType.CNI : undefined
  document.status = options.status ?? KycDocumentStatus.PENDING
  document.agentId = null

  return repository.saveWithPieces(document, [
    { pieceType: DocumentPieceType.RECTO, fileKey: `verification/${accountId}/piece.jpg` },
  ])
}
