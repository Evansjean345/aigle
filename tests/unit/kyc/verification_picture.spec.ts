import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import VerificationPictureService from '#core/identity/kyc/application/services/verification_picture_service'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'

/**
 * Caractérise la photo de profil servie à l'application mobile.
 *
 * Elle vient du selfie du dossier de vérification. Depuis que la soumission écrit des pièces au lieu
 * des colonnes, la servir suppose de signer une clé — sans quoi un utilisateur vérifié après la
 * bascule n'aurait plus de photo.
 */
test.group('Kyc | Photo de vérification', () => {
  function documentWithSelfiePiece(accountId: string): KycDocument {
    const document = new KycDocument()
    document.id = 1
    document.accountId = accountId
    document.userId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = KycDocumentStatus.APPROVED

    const selfie = new DocumentPiece()
    selfie.pieceType = DocumentPieceType.SELFIE
    selfie.fileKey = 'kyc_selfies/abc/selfie.jpg'

    const recto = new DocumentPiece()
    recto.pieceType = DocumentPieceType.RECTO
    recto.fileKey = 'kyc_documents/abc/recto.jpg'

    document.$setRelated('pieces', [recto, selfie])

    return document
  }

  function legacyDocument(accountId: string): KycDocument {
    const document = new KycDocument()
    document.id = 2
    document.accountId = accountId
    document.userId = accountId
    document.ownerType = AccountOwnerType.USER
    document.status = KycDocumentStatus.APPROVED
    document.selfieUrl = 'https://public.example/selfie.jpg'
    document.$setRelated('pieces', [])

    return document
  }

  function makeService(seed: KycDocument[]) {
    const storage = new InMemoryFileStorage()
    const service = new VerificationPictureService(new InMemoryKycDocumentRepository(seed), storage)

    return { service, storage }
  }

  test('un dossier récent rend une URL signée du selfie', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, storage } = makeService([documentWithSelfiePiece(accountId)])

    const url = await service.selfieUrlFor(accountId)

    assert.equal(url, 'https://signed.test/kyc_selfies/abc/selfie.jpg')
    assert.deepEqual(storage.signed, ['kyc_selfies/abc/selfie.jpg'])
  })

  test('seul le selfie est signé, jamais la pièce d’identité', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, storage } = makeService([documentWithSelfiePiece(accountId)])

    await service.selfieUrlFor(accountId)

    assert.lengthOf(storage.signed, 1)
    assert.notInclude(storage.signed[0], 'recto')
  })

  test('un dossier antérieur rend son URL publique, sans signature', async ({ assert }) => {
    const accountId = uuidv4()
    const { service, storage } = makeService([legacyDocument(accountId)])

    const url = await service.selfieUrlFor(accountId)

    assert.equal(url, 'https://public.example/selfie.jpg')
    assert.lengthOf(storage.signed, 0)
  })

  test('un compte sans dossier ne rend rien', async ({ assert }) => {
    const { service } = makeService([])

    assert.isNull(await service.selfieUrlFor(uuidv4()))
  })

  test('un dossier sans selfie ni colonne ne rend rien', async ({ assert }) => {
    const accountId = uuidv4()
    const document = new KycDocument()
    document.id = 3
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.status = KycDocumentStatus.PENDING
    document.$setRelated('pieces', [])

    const { service } = makeService([document])

    assert.isNull(await service.selfieUrlFor(accountId))
  })
})
