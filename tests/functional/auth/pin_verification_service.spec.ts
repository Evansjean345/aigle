import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import PinVerificationService from '#core/identity/authentication/application/services/pin_verification_service'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'

/**
 * Vérification du PIN par userId (contrat primitif réutilisé par le login business) :
 * PIN correct → passe ; PIN faux ou user inconnu → InvalidPincodeException.
 */

async function makeUserWithPin(pin: string): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Pin'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  user.pincode = pin // brut : le mixin d'auth le hash au save
  await user.save()
  return user
}

test.group('PinVerificationService', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    return async () => {
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('PIN correct → ne lève pas', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    const user = await makeUserWithPin('1234')

    await assert.doesNotReject(() => service.verify(user.usersUid, '1234'))
  })

  test('PIN incorrect → InvalidPincodeException', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    const user = await makeUserWithPin('1234')

    await assert.rejects(() => service.verify(user.usersUid, '0000'), InvalidPincodeException)
  })

  test('user inconnu → InvalidPincodeException', async ({ assert }) => {
    const service = await app.container.make(PinVerificationService)
    await assert.rejects(() => service.verify(randomUUID(), '1234'), InvalidPincodeException)
  })
})
