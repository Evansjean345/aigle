import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import InMemoryKycDocumentRepository from '#tests/fakes/kyc/in_memory_kyc_document_repository'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import InMemoryFileStorage from '#tests/fakes/shared/in_memory_file_storage'
import InMemoryAccountStanding from '#tests/fakes/account/in_memory_account_standing'
import InMemoryUserDirectory from '#tests/fakes/identity/in_memory_user_directory'

/**
 * Caractérise la lecture du détail d'un dossier par le back-office.
 *
 * Le back-office lit les images dans `documentRectoUrl`, `documentVersoUrl` et `selfieUrl`. Depuis
 * que la soumission écrit des pièces au lieu de ces colonnes, c'est ici que ces champs sont
 * réalimentés — sans quoi un dossier récent s'afficherait sans aucune image.
 */
test.group('Kyc | Détail d’un dossier', () => {
  function documentWithPieces(accountId: string): KycDocument {
    const document = new KycDocument()
    document.id = 1
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = KycDocumentStatus.PENDING

    const pieces = [
      [DocumentPieceType.RECTO, 'kyc_documents/abc/recto.jpg'],
      [DocumentPieceType.VERSO, 'kyc_documents/abc/verso.jpg'],
      [DocumentPieceType.SELFIE, 'kyc_selfies/abc/selfie.jpg'],
    ].map(([pieceType, fileKey]) => {
      const piece = new DocumentPiece()
      piece.pieceType = pieceType as DocumentPieceType
      piece.fileKey = fileKey as string

      return piece
    })

    document.$setRelated('pieces', pieces)

    return document
  }

  /** Dossier repris : ses pièces portent encore une URL, signalée par `isPublicUrl`. */
  function legacyDocument(accountId: string): KycDocument {
    const document = new KycDocument()
    document.id = 2
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = KycDocumentStatus.APPROVED

    document.$setRelated(
      'pieces',
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE].map((pieceType) => {
        const piece = new DocumentPiece()
        piece.pieceType = pieceType
        piece.fileKey = `https://public.example/${pieceType.toLowerCase()}.jpg`
        piece.isPublicUrl = true

        return piece
      })
    )

    return document
  }

  function makeService(seed: KycDocument[]) {
    const repository = new InMemoryKycDocumentRepository(seed)
    const storage = new InMemoryFileStorage()
    const standing = new InMemoryAccountStanding()
    const directory = new InMemoryUserDirectory()
    const service = new IdentityReviewService(
      repository,
      storage,
      standing as never,
      directory as never
    )

    return { service, storage }
  }

  test('le détail d’un dossier récent rend des URL signées dans les champs du back-office', async ({
    assert,
  }) => {
    const { service } = makeService([documentWithPieces(uuidv4())])

    const detail = await service.findById(1)

    assert.equal(detail!.documentRectoUrl, 'https://signed.test/kyc_documents/abc/recto.jpg')
    assert.equal(detail!.documentVersoUrl, 'https://signed.test/kyc_documents/abc/verso.jpg')
    assert.equal(detail!.selfieUrl, 'https://signed.test/kyc_selfies/abc/selfie.jpg')
  })

  test('le détail signe aussi les pièces elles-mêmes', async ({ assert }) => {
    const { service } = makeService([documentWithPieces(uuidv4())])

    const detail = await service.findById(1)

    assert.isTrue(detail!.pieces!.every((piece) => piece.url!.startsWith('https://signed.test/')))
  })

  test('une pièce reprise garde son URL publique, sans signature', async ({ assert }) => {
    const { service, storage } = makeService([legacyDocument(uuidv4())])

    const detail = await service.findById(2)

    assert.equal(detail!.documentRectoUrl, 'https://public.example/recto.jpg')
    assert.equal(detail!.selfieUrl, 'https://public.example/selfie.jpg')
    assert.lengthOf(storage.signed, 0)
  })

  test('la liste ne signe rien', async ({ assert }) => {
    const { service, storage } = makeService([documentWithPieces(uuidv4())])

    await service.list(1, 20)

    assert.lengthOf(storage.signed, 0)
  })

  test('un dossier introuvable rend null sans signer', async ({ assert }) => {
    const { service, storage } = makeService([])

    assert.isNull(await service.findById(99))
    assert.lengthOf(storage.signed, 0)
  })
})
