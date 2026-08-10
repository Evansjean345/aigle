import { test } from '@japa/runner'
import { v4 as uuidv4 } from 'uuid'
import KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import DocumentPiece from '#core/identity/kyc/domain/models/document_piece'
import { DocumentPieceType, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

test.group('Kyc | Document Piece', () => {
  test('le catalogue des rôles de pièce couvre la pièce d’identité', async ({ assert }) => {
    assert.equal(DocumentPieceType.RECTO, 'RECTO')
    assert.equal(DocumentPieceType.VERSO, 'VERSO')
    assert.equal(DocumentPieceType.SELFIE, 'SELFIE')
  })

  test('une pièce porte une clé de stockage et jamais une URL', async ({ assert }) => {
    const piece = new DocumentPiece()
    piece.pieceType = DocumentPieceType.RECTO
    piece.fileKey = 'kyc_documents/abc/def.jpg'

    assert.equal(piece.fileKey, 'kyc_documents/abc/def.jpg')
    assert.notProperty(piece, 'fileUrl')
  })

  test('une pièce peut porter la référence inscrite dessus', async ({ assert }) => {
    const piece = new DocumentPiece()
    piece.pieceType = DocumentPieceType.RECTO
    piece.fileKey = 'kyc_documents/abc/def.jpg'

    assert.isUndefined(piece.reference)

    piece.reference = 'CI-ABJ-2020-B-12345'
    assert.equal(piece.reference, 'CI-ABJ-2020-B-12345')
  })

  test('un dossier expose les pièces qui lui sont rattachées', async ({ assert }) => {
    const accountId = uuidv4()
    const document = new KycDocument()
    document.accountId = accountId
    document.ownerType = AccountOwnerType.USER
    document.documentType = KycDocumentType.CNI

    const recto = new DocumentPiece()
    recto.pieceType = DocumentPieceType.RECTO
    recto.fileKey = 'kyc_documents/recto.jpg'

    const selfie = new DocumentPiece()
    selfie.pieceType = DocumentPieceType.SELFIE
    selfie.fileKey = 'kyc_selfies/selfie.jpg'

    document.$setRelated('pieces', [recto, selfie])

    assert.lengthOf(document.pieces, 2)
    assert.sameMembers(
      document.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE]
    )
  })

  test('un dossier se rattache à un compte, utilisateur ou organisation', async ({ assert }) => {
    const userDocument = new KycDocument()
    userDocument.accountId = uuidv4()
    userDocument.ownerType = AccountOwnerType.USER
    userDocument.documentType = KycDocumentType.CNI

    const orgDocument = new KycDocument()
    orgDocument.accountId = uuidv4()
    orgDocument.ownerType = AccountOwnerType.ORGANISATION

    assert.equal(userDocument.ownerType, 'user')
    assert.equal(orgDocument.ownerType, 'organisation')
    assert.isUndefined(orgDocument.documentType)
  })

  test('une tentative se rattache au même compte que son dossier', async ({ assert }) => {
    const { KycAttemp } = await import('#core/identity/kyc/domain/models/kyc_attemp')
    const accountId = uuidv4()

    const attempt = new KycAttemp()
    attempt.accountId = accountId

    assert.equal(attempt.accountId, accountId)
  })
})
