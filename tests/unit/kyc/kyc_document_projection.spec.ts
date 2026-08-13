import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import { toKycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'
import {
  DocumentPieceType,
  KycDocumentStatus,
  KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Caractérise la projection d'un dossier hors du contexte identity.
 *
 * Deux générations de dossiers cohabitent : ceux écrits depuis la bascule portent des pièces avec
 * une clé de stockage privé, ceux d'avant portent trois colonnes d'URL publiques. La projection rend
 * les deux sous la même forme, sans que l'appelant ait à savoir laquelle il lit.
 */
test.group('Kyc | Projection du dossier', () => {
  /** Dossier neuf, dont les pièces sont déjà chargées. */
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

  /**
   * Dossier repris d'un dépôt public : ses pièces sont dans `document_pieces`, mais portent encore
   * une URL au lieu d'une clé, ce que `isPublicUrl` signale.
   */
  function legacyDocument(accountId: string, roles = ['RECTO', 'VERSO', 'SELFIE']): KycDocument {
    const document = new KycDocument()
    document.id = 2
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI
    document.status = KycDocumentStatus.APPROVED

    document.$setRelated(
      'pieces',
      roles.map((role) => {
        const piece = new DocumentPiece()
        piece.pieceType = role as DocumentPieceType
        piece.fileKey = `https://public.example/${role.toLowerCase()}.jpg`
        piece.isPublicUrl = true

        return piece
      })
    )

    return document
  }

  test('un dossier récent projette ses pièces', async ({ assert }) => {
    const result = toKycDocumentResult(documentWithPieces(uuidv4()))

    assert.sameMembers(
      result.pieces!.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.VERSO, DocumentPieceType.SELFIE]
    )
    assert.equal(
      result.pieces!.find((piece) => piece.pieceType === DocumentPieceType.RECTO)!.fileKey,
      'kyc_documents/abc/recto.jpg'
    )
  })

  test('un dossier repris projette ses pièces sous la même forme', async ({ assert }) => {
    const result = toKycDocumentResult(legacyDocument(uuidv4()))

    assert.sameMembers(
      result.pieces!.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.VERSO, DocumentPieceType.SELFIE]
    )
    assert.equal(
      result.pieces!.find((piece) => piece.pieceType === DocumentPieceType.SELFIE)!.fileKey,
      'https://public.example/selfie.jpg'
    )
  })

  test('une pièce héritée se signale comme déjà lisible', async ({ assert }) => {
    const legacy = toKycDocumentResult(legacyDocument(uuidv4()))
    const recent = toKycDocumentResult(documentWithPieces(uuidv4()))

    assert.isTrue(legacy.pieces!.every((piece) => piece.isPublicUrl))
    assert.isTrue(recent.pieces!.every((piece) => !piece.isPublicUrl))
  })

  test('un passeport repris ne projette pas de verso vide', async ({ assert }) => {
    const document = legacyDocument(uuidv4(), ['RECTO', 'SELFIE'])
    document.documentType = KycDocumentType.PASSPORT

    const result = toKycDocumentResult(document)

    assert.sameMembers(
      result.pieces!.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE]
    )
  })

  test('un dossier sans pièce ni colonne projette une liste vide', async ({ assert }) => {
    const document = new KycDocument()
    document.id = 3
    document.accountId = uuidv4()
    document.ownerType = AccountOwnerType.ORGANISATION
    document.status = KycDocumentStatus.IN_SUBMISSION
    document.$setRelated('pieces', [])

    const result = toKycDocumentResult(document)

    assert.isArray(result.pieces)
    assert.lengthOf(result.pieces!, 0)
  })

  test('le compte et la nature du propriétaire traversent la frontière', async ({ assert }) => {
    const accountId = uuidv4()
    const result = toKycDocumentResult(documentWithPieces(accountId))

    assert.equal(result.accountId, accountId)
    assert.equal(result.ownerType, AccountOwnerType.USER)
    assert.equal(result.userId, accountId)
  })

  test('le porteur d’un dossier d’organisation est le compte, jamais la colonne héritée', async ({
    assert,
  }) => {
    const organisationId = uuidv4()
    const document = new KycDocument()
    document.id = 4
    document.accountId = organisationId
    document.ownerType = AccountOwnerType.ORGANISATION
    document.status = KycDocumentStatus.PENDING
    document.$setRelated('pieces', [])

    // `user_id` est nul pour une organisation : le lire rendrait une projection sans porteur.
    const result = toKycDocumentResult(document)

    assert.equal(result.userId, organisationId)
  })

  test('aucune URL signée ne fuite dans la projection', async ({ assert }) => {
    const result = toKycDocumentResult(documentWithPieces(uuidv4()))

    assert.isTrue(result.pieces!.every((piece) => !('url' in piece)))
  })
})
