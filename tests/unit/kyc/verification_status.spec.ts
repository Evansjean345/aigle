import { test } from '@japa/runner'
import {
  AccountVerificationStatus,
  statusOfFile,
} from '#core/identity/kyc/domain/verification_status'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Caractérise le statut de vérification tel qu'il se dérive du dossier.
 *
 * Le dossier est le fait ; le statut n'en est qu'une lecture.
 */
test.group('Kyc | Statut dérivé du dossier', () => {
  test('un compte sans dossier n’a rien commencé', async ({ assert }) => {
    assert.equal(statusOfFile(null), AccountVerificationStatus.NOT_STARTED)
    assert.equal(statusOfFile(), AccountVerificationStatus.NOT_STARTED)
  })

  test('un dossier en constitution n’a rien commencé', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.IN_SUBMISSION }),
      AccountVerificationStatus.NOT_STARTED
    )
  })

  test('un dossier en revue est en attente', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.PENDING }),
      AccountVerificationStatus.PENDING_IN_REVIEW
    )
  })

  test('un dossier approuvé vérifie le compte', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.APPROVED }),
      AccountVerificationStatus.VERIFIED
    )
  })

  test('un dossier refusé rejette le compte', async ({ assert }) => {
    assert.equal(
      statusOfFile({ status: KycDocumentStatus.REJECTED }),
      AccountVerificationStatus.REJECTED
    )
  })
})
