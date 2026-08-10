import { test } from '@japa/runner'
import KycDocumentAdminService from '#core/identity/kyc/application/services/kyc_document_admin_service'
import type KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { KycDocumentStatus, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'

test.group('Kyc | revue des documents', () => {
  test("devrait lever une exception si le document n'existe pas", async ({ assert }) => {
    const mockRepo = {
      findById: async () => null,
      saveKycDocument: async (doc: any) => doc,
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findByAccountId: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async () => {},
    } as unknown as KycDocumentRepository

    const service = new KycDocumentAdminService(mockRepo)

    await assert.rejects(
      () => service.process({ documentId: 1, status: KycDocumentStatus.APPROVED, agentId: 1 }),
      KycDocumentNotFoundException
    )
  })

  test('devrait approuver le document et enregistrer une tentative', async ({ assert }) => {
    const kycDoc = new KycDocument()
    kycDoc.id = 1
    kycDoc.userId = 'user-123'
    kycDoc.documentType = KycDocumentType.CNI
    kycDoc.status = KycDocumentStatus.PENDING

    let savedDoc: KycDocument | null = null
    let savedAttempt: any = null

    const mockRepo = {
      findById: async () => kycDoc,
      saveKycDocument: async (doc: any) => {
        savedDoc = doc
        return doc
      },
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findByAccountId: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async (attempt: any) => {
        savedAttempt = attempt
      },
    } as unknown as KycDocumentRepository

    const service = new KycDocumentAdminService(mockRepo)

    await service.process({
      documentId: 1,
      status: KycDocumentStatus.APPROVED,
      comment: 'Bon document',
      agentId: 1,
    })

    assert.equal(savedDoc?.status, KycDocumentStatus.APPROVED)
    assert.equal(savedDoc?.comment, 'Bon document')
    assert.equal(savedAttempt?.status, KycDocumentStatus.APPROVED)
    assert.equal(savedAttempt?.attemptNumber, 1)
  })

  test('devrait rejeter le document et enregistrer une tentative', async ({ assert }) => {
    const kycDoc = new KycDocument()
    kycDoc.id = 1
    kycDoc.userId = 'user-123'
    kycDoc.documentType = KycDocumentType.CNI
    kycDoc.status = KycDocumentStatus.PENDING

    let savedDoc: KycDocument | null = null
    let savedAttempt: any = null

    const mockRepo = {
      findById: async () => kycDoc,
      saveKycDocument: async (doc: any) => {
        savedDoc = doc
        return doc
      },
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findByAccountId: async () => null,
      findLastAttempt: async () => ({ attemptNumber: 1 }) as any,
      saveAttempt: async (attempt: any) => {
        savedAttempt = attempt
      },
    } as unknown as KycDocumentRepository

    const service = new KycDocumentAdminService(mockRepo)

    await service.process({
      documentId: 1,
      status: KycDocumentStatus.REJECTED,
      comment: 'Photo floue',
      agentId: 1,
    })

    assert.equal(savedDoc?.status, KycDocumentStatus.REJECTED)
    assert.equal(savedAttempt?.status, KycDocumentStatus.REJECTED)
    assert.equal(savedAttempt?.attemptNumber, 2)
  })
})
