import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import SubmitKycDocumentUsecase from '#features/kyc/application/usecases/mobile/submit_kyc_document.usecase'
import type KycDocumentRepository from '#features/kyc/domain/interfaces/kyc_document_repository'
import type FileStorageService from '#shared/infrastructure/services/file_storage_service'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import type KycDocument from '#features/kyc/domain/models/kyc_document'
import KycAlreadySubmittedException from '#features/kyc/infrastructure/exceptions/kyc_already_submitted_exception'
import MissingKycDocumentsException from '#features/kyc/infrastructure/exceptions/missing_kyc_documents_exception'

test.group('Kyc | Submit Use Case', () => {
  test('devrait empêcher une soumission si un KYC est déjà APPROVED', async ({ assert }) => {
    const userId = uuidv4()

    const mockRepo = {
      findUserKycDocument: async () => ({ status: KycDocumentStatus.APPROVED }) as KycDocument,
      saveKycDocument: async (doc: any) => doc,
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findById: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async () => {},
    } as unknown as KycDocumentRepository

    const mockStorage = {
      uploadFile: async () => 'http://fake-url.com/file.jpg',
    } as unknown as FileStorageService

    const usecase = new SubmitKycDocumentUsecase(mockRepo, mockStorage)

    await assert.rejects(
      () =>
        usecase.execute(userId, {
          documentType: KycDocumentType.CNI,
          documentRectoUrl: {},
          documentVersoUrl: {},
          documentsSelfieUrl: {},
        }),
      KycAlreadySubmittedException
    )
  })

  test('devrait empêcher une soumission si un KYC est déjà PENDING', async ({ assert }) => {
    const userId = uuidv4()

    const mockRepo = {
      findUserKycDocument: async () => ({ status: KycDocumentStatus.PENDING }) as KycDocument,
      saveKycDocument: async (doc: any) => doc,
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findById: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async () => {},
    } as unknown as KycDocumentRepository

    const mockStorage = {
      uploadFile: async () => 'http://fake-url.com/file.jpg',
    } as unknown as FileStorageService

    const usecase = new SubmitKycDocumentUsecase(mockRepo, mockStorage)

    await assert.rejects(
      () =>
        usecase.execute(userId, {
          documentType: KycDocumentType.CNI,
          documentRectoUrl: {},
          documentVersoUrl: {},
          documentsSelfieUrl: {},
        }),
      KycAlreadySubmittedException
    )
  })

  test('devrait lever une exception si des documents sont manquants (CNI sans verso)', async ({
    assert,
  }) => {
    const userId = uuidv4()

    const mockRepo = {
      findUserKycDocument: async () => null,
      saveKycDocument: async (doc: any) => doc,
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findById: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async () => {},
    } as unknown as KycDocumentRepository

    const mockStorage = {
      uploadFile: async () => 'http://fake-url.com/file.jpg',
    } as unknown as FileStorageService

    const usecase = new SubmitKycDocumentUsecase(mockRepo, mockStorage)

    await assert.rejects(
      () =>
        usecase.execute(userId, {
          documentType: KycDocumentType.CNI,
          documentRectoUrl: 'recto.jpg' as any,
          documentVersoUrl: null as any,
          documentsSelfieUrl: 'selfie.jpg' as any,
        }),
      MissingKycDocumentsException
    )
  })

  test("devrait réussir la soumission si c'est le premier dépôt", async ({ assert }) => {
    const userId = uuidv4()

    const mockRepo = {
      findUserKycDocument: async () => null,
      saveKycDocument: async (doc: any) => {
        doc.id = 1
        return doc
      },
      findAll: async () => ({}) as any,
      getStats: async () => ({}) as any,
      findById: async () => null,
      findLastAttempt: async () => null,
      saveAttempt: async () => {},
    } as unknown as KycDocumentRepository

    const mockStorage = {
      uploadFile: async () => 'http://fake-url.com/file.jpg',
    } as unknown as FileStorageService

    const usecase = new SubmitKycDocumentUsecase(mockRepo, mockStorage)

    const result = await usecase.execute(userId, {
      documentType: KycDocumentType.PASSPORT,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: null as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.equal(result.message, 'Documents Kyc soumis avec succès 📄')
  })
})
