import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import PinVerificationService from '#core/identity/authentication/application/services/pin_verification_service'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Vérification du PIN par userId (contrat primitif réutilisé par le login business) :
 * PIN correct → passe ; PIN faux ou user inconnu → InvalidPincodeException.
 */

test.group('PinVerificationService', (group) => {
  group.each.setup(authTestSetup())

  test('PIN correct → ne lève pas', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    const user = await makeUser({ pincode: '1234' })

    await assert.doesNotReject(() => service.verify(user.usersUid, '1234'))
  })

  test('PIN incorrect → InvalidPincodeException', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    const user = await makeUser({ pincode: '1234' })

    await assert.rejects(() => service.verify(user.usersUid, '0000'), InvalidPincodeException)
  })

  test('user inconnu → InvalidPincodeException', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    await assert.rejects(() => service.verify(randomUUID(), '1234'), InvalidPincodeException)
  })
})
