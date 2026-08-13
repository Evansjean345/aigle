import type KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import type { DocumentPieceInput } from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import type { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import { DocumentPieceType, type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Dépôt de dossiers en mémoire, pour les tests qui n'ont pas à toucher la base.
 *
 * Implémente le port sans cast : une méthode ajoutée au contrat casse la compilation ici, au lieu de
 * laisser un test passer sur un dépôt qui ne sait plus répondre.
 *
 * Les pièces et les tentatives reçues restent accessibles après l'appel, pour être inspectées.
 */
export default class InMemoryKycDocumentRepository implements KycDocumentRepository {
  documents: KycDocument[] = []
  pieces: DocumentPieceInput[] = []
  attempts: KycAttemp[] = []

  constructor(seed: KycDocument[] = []) {
    this.documents = [...seed]
  }

  async findByAccountId(accountId: string): Promise<KycDocument | null> {
    const document = this.documents.find((one) => one.accountId === accountId) ?? null

    if (document) this.attachPieces(document)

    return document
  }

  /**
   * Rattache au dossier les pièces retenues, comme le ferait un `preload`.
   *
   * Sans effet tant qu'aucune pièce n'a été écrite : un dossier pré-alimenté par un test garde
   * celles qu'il porte déjà.
   */
  private attachPieces(kycDocument: KycDocument): void {
    if (this.pieces.length === 0) return

    kycDocument.$setRelated(
      'pieces',
      this.pieces.map((piece) => {
        const attached = new DocumentPiece()
        attached.kycDocumentId = kycDocument.id
        attached.pieceType = piece.pieceType
        attached.fileKey = piece.fileKey
        attached.reference = piece.reference

        return attached
      }) as any
    )
  }

  async saveKycDocument(kycDocument: KycDocument): Promise<KycDocument> {
    this.upsert(kycDocument)

    return kycDocument
  }

  /**
   * Écrit le dossier et remplace, rôle par rôle, les pièces reçues.
   *
   * Reproduit l'unicité `(dossier, type)` du vrai dépôt : une pièce déjà présente pour le même rôle
   * voit sa clé remplacée, les autres restent.
   */
  async saveWithPieces(
    kycDocument: KycDocument,
    pieces: DocumentPieceInput[]
  ): Promise<KycDocument> {
    this.upsert(kycDocument)

    const kept = this.pieces.filter(
      (held) => !pieces.some((incoming) => incoming.pieceType === held.pieceType)
    )

    this.pieces = [...kept, ...pieces]
    this.attachPieces(kycDocument)

    return kycDocument
  }

  async findAll(): Promise<any> {
    return { all: () => this.documents, getMeta: () => ({ total: this.documents.length }) }
  }

  async getStats(): Promise<any> {
    return { total: this.documents.length }
  }

  async findById(id: number): Promise<KycDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null
  }

  async findLastAttempt(kycDocumentId: number): Promise<KycAttemp | null> {
    const forDocument = this.attempts.filter((attempt) => attempt.kycDocumentId === kycDocumentId)

    return forDocument.sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null
  }

  async saveAttempt(attempt: KycAttemp): Promise<void> {
    this.attempts.push(attempt)
  }

  async countByStatus(status: KycDocumentStatus): Promise<number> {
    return this.documents.filter((document) => document.status === status).length
  }

  async findSelfiePiecesByAccountIds(
    accountIds: string[]
  ): Promise<Map<string, { fileKey: string; isPublicUrl: boolean }>> {
    const wanted = new Set(accountIds)
    const found = new Map<string, { fileKey: string; isPublicUrl: boolean }>()

    for (const document of this.documents) {
      if (!wanted.has(document.accountId)) continue

      const selfie = document.pieces?.find(
        (piece) => piece.pieceType === DocumentPieceType.SELFIE
      )

      if (selfie) {
        found.set(document.accountId, {
          fileKey: selfie.fileKey,
          isPublicUrl: Boolean(selfie.isPublicUrl),
        })
        continue
      }

      // Dossier antérieur à la reprise des pièces : son adresse est déjà consultable.
      if (document.selfieUrl) {
        found.set(document.accountId, { fileKey: document.selfieUrl, isPublicUrl: true })
      }
    }

    return found
  }

  async countByStatusForOwnerType(ownerType: string): Promise<Record<string, number>> {
    return this.documents
      .filter((document) => document.ownerType === ownerType)
      .reduce<Record<string, number>>((counts, document) => {
        counts[document.status] = (counts[document.status] ?? 0) + 1
        return counts
      }, {})
  }

  /** Range le dossier, en lui attribuant un identifiant s'il n'en a pas encore. */
  private upsert(kycDocument: KycDocument): void {
    if (!kycDocument.id) {
      kycDocument.id = this.documents.length + 1
    }

    const index = this.documents.findIndex((document) => document.id === kycDocument.id)

    if (index >= 0) {
      this.documents[index] = kycDocument
    } else {
      this.documents.push(kycDocument)
    }
  }
}
