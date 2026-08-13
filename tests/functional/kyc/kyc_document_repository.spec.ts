import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import { KycAttemp } from '#core/identity/kyc/domain/models/kyc_attemp'
import KycDocumentRepositoryImpl from '#core/identity/kyc/infrastructure/repositories/kyc_document_repository_impl'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Caractérise l'ancrage du dossier de vérification sur le compte et l'écriture de ses pièces.
 *
 * Les pièces sont écrites avec le dossier dans une seule transaction : un dossier `pending` sans
 * pièce n'atteindrait jamais un gestionnaire en état d'être revu.
 */
test.group('Kyc | Repository de dossier', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  const repository = new KycDocumentRepositoryImpl()

  /** Dossier d'un compte utilisateur, sans pièce. */
  function makeDocument(accountId: string): KycDocument {
    const document = new KycDocument()
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = KycDocumentStatus.PENDING
    document.agentId = null

    return document
  }

  test('retrouve le dossier par le compte', async ({ assert }) => {
    const accountId = randomUUID()
    await repository.saveWithPieces(makeDocument(accountId), [
      { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/recto.jpg' },
    ])

    const found = await repository.findByAccountId(accountId)

    assert.isNotNull(found)
    assert.equal(found!.accountId, accountId)
    assert.equal(found!.ownerType, AccountOwnerType.USER)
  })

  test('rend null quand le compte n’a aucun dossier', async ({ assert }) => {
    assert.isNull(await repository.findByAccountId(randomUUID()))
  })

  test('écrit le dossier et ses pièces', async ({ assert }) => {
    const accountId = randomUUID()

    const saved = await repository.saveWithPieces(makeDocument(accountId), [
      { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/recto.jpg' },
      { pieceType: DocumentPieceType.VERSO, fileKey: 'kyc_documents/verso.jpg' },
      { pieceType: DocumentPieceType.SELFIE, fileKey: 'kyc_selfies/selfie.jpg' },
    ])

    const pieces = await DocumentPiece.query().where('kyc_document_id', saved.id)

    assert.lengthOf(pieces, 3)
    assert.sameMembers(
      pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.VERSO, DocumentPieceType.SELFIE]
    )
    assert.isTrue(pieces.every((piece) => piece.fileKey.length > 0))
  })

  test('porte la référence inscrite sur la pièce', async ({ assert }) => {
    const accountId = randomUUID()

    const saved = await repository.saveWithPieces(makeDocument(accountId), [
      {
        pieceType: DocumentPieceType.RECTO,
        fileKey: 'verification/rccm.pdf',
        reference: 'CI-ABJ-2020-B-12345',
      },
    ])

    const piece = await DocumentPiece.query().where('kyc_document_id', saved.id).firstOrFail()

    assert.equal(piece.reference, 'CI-ABJ-2020-B-12345')
  })

  test('une resoumission remplace la pièce au lieu de l’empiler', async ({ assert }) => {
    const accountId = randomUUID()

    const saved = await repository.saveWithPieces(makeDocument(accountId), [
      { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/premier.jpg' },
    ])

    await repository.saveWithPieces(saved, [
      { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/second.jpg' },
    ])

    const pieces = await DocumentPiece.query().where('kyc_document_id', saved.id)

    assert.lengthOf(pieces, 1)
    assert.equal(pieces[0].fileKey, 'kyc_documents/second.jpg')
  })

  test('ne laisse ni dossier ni pièce quand une pièce échoue', async ({ assert }) => {
    const accountId = randomUUID()
    const original = DocumentPiece.updateOrCreate
    let calls = 0

    DocumentPiece.updateOrCreate = (async (...args: any[]) => {
      calls += 1
      if (calls === 2) throw new Error('écriture de pièce interrompue')
      return (original as any).apply(DocumentPiece, args)
    }) as typeof DocumentPiece.updateOrCreate

    try {
      await assert.rejects(() =>
        repository.saveWithPieces(makeDocument(accountId), [
          { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/recto.jpg' },
          { pieceType: DocumentPieceType.VERSO, fileKey: 'kyc_documents/verso.jpg' },
        ])
      )
    } finally {
      DocumentPiece.updateOrCreate = original
    }

    assert.isNull(await repository.findByAccountId(accountId))
    assert.lengthOf(await DocumentPiece.query().whereIn('file_key', ['kyc_documents/recto.jpg']), 0)
  })

  test('la dernière tentative se cherche par dossier', async ({ assert }) => {
    const accountId = randomUUID()
    const saved = await repository.saveWithPieces(makeDocument(accountId), [
      { pieceType: DocumentPieceType.RECTO, fileKey: 'kyc_documents/recto.jpg' },
    ])

    assert.isNull(await repository.findLastAttempt(saved.id))

    for (const attemptNumber of [1, 2]) {
      const attempt = new KycAttemp()
      attempt.accountId = accountId
      attempt.kycDocumentId = saved.id
      attempt.documentType = KycDocumentType.CNI
      attempt.attemptNumber = attemptNumber
      attempt.status = KycDocumentStatus.PENDING
      attempt.agentId = null
      await repository.saveAttempt(attempt)
    }

    const last = await repository.findLastAttempt(saved.id)

    assert.isNotNull(last)
    assert.equal(last!.attemptNumber, 2)
  })
})
