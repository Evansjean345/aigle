import { test } from '@japa/runner'
import {
  SubmissionMode,
  missingPieces,
  requirementsFor,
} from '#core/identity/kyc/domain/verification_requirements'
import { DocumentPieceType, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'

/**
 * Caractérise ce qu'un dossier doit contenir pour être complet.
 *
 * C'est ce catalogue qui décide du passage de `in_submission` à `pending` : tant qu'il rend des
 * pièces manquantes, le dossier n'atteint pas la file de revue.
 */
test.group('Kyc | Catalogue de complétude', () => {
  test('une entreprise doit son RCCM et son DFE', async ({ assert }) => {
    const requirements = requirementsFor(AccountSegment.ENTERPRISE)

    assert.sameMembers(
      requirements.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RCCM, DocumentPieceType.DFE]
    )
  })

  test('une entreprise dépose ses pièces au fil de l’eau', async ({ assert }) => {
    assert.equal(requirementsFor(AccountSegment.ENTERPRISE).mode, SubmissionMode.PROGRESSIVE)
  })

  test('les pièces d’entreprise exigent une référence', async ({ assert }) => {
    const requirements = requirementsFor(AccountSegment.ENTERPRISE)

    assert.isTrue(requirements.pieces.every((piece) => piece.requiresReference))
  })

  test('un particulier dépose son dossier d’un seul coup', async ({ assert }) => {
    assert.equal(requirementsFor(AccountSegment.PARTICULIER).mode, SubmissionMode.ATOMIC)
  })

  test('une pièce d’identité ne porte pas de référence', async ({ assert }) => {
    const requirements = requirementsFor(AccountSegment.PARTICULIER, KycDocumentType.CNI)

    assert.isTrue(requirements.pieces.every((piece) => !piece.requiresReference))
  })

  test('une CNI demande recto, verso et selfie', async ({ assert }) => {
    const requirements = requirementsFor(AccountSegment.PARTICULIER, KycDocumentType.CNI)

    assert.sameMembers(
      requirements.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.VERSO, DocumentPieceType.SELFIE]
    )
  })

  test('un passeport n’a pas de verso', async ({ assert }) => {
    const requirements = requirementsFor(AccountSegment.PARTICULIER, KycDocumentType.PASSPORT)

    assert.sameMembers(
      requirements.pieces.map((piece) => piece.pieceType),
      [DocumentPieceType.RECTO, DocumentPieceType.SELFIE]
    )
  })

  test('un marchand ne passe aucune vérification', async ({ assert }) => {
    assert.isEmpty(requirementsFor(AccountSegment.MARCHAND).pieces)
  })

  test('rien ne manque à un dossier complet', async ({ assert }) => {
    const missing = missingPieces(AccountSegment.ENTERPRISE, undefined, [
      { pieceType: DocumentPieceType.RCCM, hasReference: true },
      { pieceType: DocumentPieceType.DFE, hasReference: true },
    ])

    assert.isEmpty(missing)
  })

  test('la pièce absente est nommée', async ({ assert }) => {
    const missing = missingPieces(AccountSegment.ENTERPRISE, undefined, [
      { pieceType: DocumentPieceType.RCCM, hasReference: true },
    ])

    assert.deepEqual(missing, [DocumentPieceType.DFE])
  })

  test('une pièce sans sa référence compte comme absente', async ({ assert }) => {
    const missing = missingPieces(AccountSegment.ENTERPRISE, undefined, [
      { pieceType: DocumentPieceType.RCCM, hasReference: true },
      { pieceType: DocumentPieceType.DFE, hasReference: false },
    ])

    assert.deepEqual(missing, [DocumentPieceType.DFE])
  })

  test('une pièce hors catalogue ne rend pas le dossier complet', async ({ assert }) => {
    const missing = missingPieces(AccountSegment.ENTERPRISE, undefined, [
      { pieceType: DocumentPieceType.SELFIE, hasReference: false },
    ])

    assert.sameMembers(missing, [DocumentPieceType.RCCM, DocumentPieceType.DFE])
  })

  test('un dossier de particulier se mesure au type de sa pièce', async ({ assert }) => {
    const pieces = [
      { pieceType: DocumentPieceType.RECTO, hasReference: false },
      { pieceType: DocumentPieceType.SELFIE, hasReference: false },
    ]

    assert.isEmpty(missingPieces(AccountSegment.PARTICULIER, KycDocumentType.PASSPORT, pieces))
    assert.deepEqual(missingPieces(AccountSegment.PARTICULIER, KycDocumentType.CNI, pieces), [
      DocumentPieceType.VERSO,
    ])
  })
})
