import type KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import type { DocumentPieceInput } from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import type { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import { type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

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
    return this.documents.find((document) => document.accountId === accountId) ?? null
  }

  async saveKycDocument(kycDocument: KycDocument): Promise<KycDocument> {
    this.upsert(kycDocument)

    return kycDocument
  }

  async saveWithPieces(
    kycDocument: KycDocument,
    pieces: DocumentPieceInput[]
  ): Promise<KycDocument> {
    this.upsert(kycDocument)
    this.pieces = pieces

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
