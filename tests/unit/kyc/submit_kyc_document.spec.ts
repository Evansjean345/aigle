import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import SubmitKycDocumentUsecase from '#core/identity/kyc/application/usecases/mobile/submit_kyc_document.usecase'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import KycAlreadySubmittedException from '#core/identity/kyc/domain/exceptions/kyc_already_submitted_exception'
import MissingKycDocumentsException from '#core/identity/kyc/domain/exceptions/missing_kyc_documents_exception'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import emitter from '@adonisjs/core/services/emitter'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'
import AccountVerificationService from '#core/identity/kyc/application/services/account_verification_service'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'

/** Dossier déjà déposé, dans l'état donné. */
function existingDocument(accountId: string, status: KycDocumentStatus): KycDocument {
  const document = new KycDocument()
  document.id = 1
  document.accountId = accountId
  document.userId = accountId
  document.ownerType = AccountOwnerType.USER
  document.documentType = KycDocumentType.CNI
  document.status = status

  return document
}

/** Décrit tout compte comme un compte utilisateur particulier. */
const accounts = {
  async describe(accountId: string) {
    return {
      accountId,
      ownerType: AccountOwnerType.USER,
      segment: AccountSegment.PARTICULIER,
      status: AccountStatus.ACTIVE,
    }
  },
}

/** Use case câblé sur le service de vérification, lui-même en mémoire. */
function makeUsecase(seed: KycDocument[] = []) {
  const repository = new InMemoryKycDocumentRepository(seed)
  const storage = new InMemoryFileStorage()
  const verification = new AccountVerificationService(repository, storage, accounts as any)

  return { usecase: new SubmitKycDocumentUsecase(verification), repository, storage }
}

test.group('Kyc | Submit Use Case', (group) => {
  group.each.setup(() => {
    emitter.fake()
    return () => emitter.restore()
  })

  test('devrait empêcher une soumission si un KYC est déjà APPROVED', async ({ assert }) => {
    const userId = uuidv4()
    const { usecase } = makeUsecase([existingDocument(userId, KycDocumentStatus.APPROVED)])

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
    const { usecase } = makeUsecase([existingDocument(userId, KycDocumentStatus.PENDING)])

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
    const { usecase } = makeUsecase()

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
    const { usecase } = makeUsecase()

    const result = await usecase.execute(userId, {
      documentType: KycDocumentType.PASSPORT,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: null as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.equal(result.message, 'Documents Kyc soumis avec succès 📄')
  })

  test('une CNI produit trois pièces typées', async ({ assert }) => {
    const userId = uuidv4()
    const { usecase, repository } = makeUsecase()

    await usecase.execute(userId, {
      documentType: KycDocumentType.CNI,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: { extname: 'jpg' } as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.sameMembers(
      repository.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.VERSO, DocumentPieceType.SELFIE]
    )
  })

  test('un passeport produit deux pièces, sans verso', async ({ assert }) => {
    const userId = uuidv4()
    const { usecase, repository } = makeUsecase()

    await usecase.execute(userId, {
      documentType: KycDocumentType.PASSPORT,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: null as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.sameMembers(
      repository.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE]
    )
  })

  test('les pièces sont déposées sur le stockage privé, jamais le public', async ({ assert }) => {
    const userId = uuidv4()
    const { usecase, repository, storage } = makeUsecase()

    await usecase.execute(userId, {
      documentType: KycDocumentType.CNI,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: { extname: 'jpg' } as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.lengthOf(storage.publicUploads, 0)
    assert.lengthOf(storage.privateUploads, 3)
    assert.isTrue(repository.pieces.every((piece) => !piece.fileKey.startsWith('http')))
  })

  test('le dossier est ancré sur le compte et ses colonnes d’URL restent vides', async ({
    assert,
  }) => {
    const userId = uuidv4()
    const { usecase, repository } = makeUsecase()

    await usecase.execute(userId, {
      documentType: KycDocumentType.CNI,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: { extname: 'jpg' } as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    const document = await repository.findByAccountId(userId)

    assert.isNotNull(document)
    assert.equal(document!.ownerType, AccountOwnerType.USER)
    assert.equal(document!.status, KycDocumentStatus.PENDING)
    assert.isUndefined(document!.documentRectoUrl)
    assert.isUndefined(document!.documentVersoUrl)
    assert.isUndefined(document!.selfieUrl)
  })

  test('une resoumission après refus réutilise le dossier existant', async ({ assert }) => {
    const userId = uuidv4()
    const { usecase, repository } = makeUsecase([
      existingDocument(userId, KycDocumentStatus.REJECTED),
    ])

    await usecase.execute(userId, {
      documentType: KycDocumentType.CNI,
      documentRectoUrl: { extname: 'jpg' } as any,
      documentVersoUrl: { extname: 'jpg' } as any,
      documentsSelfieUrl: { extname: 'jpg' } as any,
    })

    assert.lengthOf(repository.documents, 1)
    assert.equal(repository.documents[0].status, KycDocumentStatus.PENDING)
  })
})
