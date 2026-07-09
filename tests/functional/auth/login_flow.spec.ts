import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import NotificationService from '#core/notifications/application/services/notification_service'
import VerifyCredentialsUseCase from '#core/identity/authentication/application/use_cases/verify_credentials_use_case'
import VerifyAndAuthenticateUserAccountUseCase from '#core/identity/authentication/application/use_cases/verify_and_authenticate_user_account_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Login mobile aiglesend au niveau des use cases (le vrai chemin, sans le HTTP) :
 * verify-credentials (PIN → OTP) puis verify-account (OTP → token stampé
 * app:aiglesend). SMS et vérification OTP réelle neutralisés (frontières core).
 * Pays 52 = Côte d'Ivoire (phone_code 225), donc un phone déjà en `225…` est
 * idempotent au formatage.
 */

class SilentNotificationService {
  async sendSms(): Promise<void> {}
}
class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

async function makeUser(pin: string, status: UserStatus = UserStatus.ACTIVE): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Login'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = status
  user.accountType = 'freemium'
  user.pincode = pin
  await user.save()
  return user
}

test.group('Auth login | verify-credentials (PIN → OTP)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(NotificationService, () => new SilentNotificationService() as never)
    return async () => {
      app.container.restore(NotificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('PIN correct → envoie l’OTP (résout)', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    const user = await makeUser('1234')

    await assert.doesNotReject(() =>
      useCase.execute({ country_id: 52, phone: user.phone, pincode: '1234' } as never)
    )
  })

  test('PIN incorrect → InvalidPincodeException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    const user = await makeUser('1234')

    await assert.rejects(
      () => useCase.execute({ country_id: 52, phone: user.phone, pincode: '0000' } as never),
      InvalidPincodeException
    )
  })

  test('téléphone inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    await assert.rejects(
      () => useCase.execute({ country_id: 52, phone: '225000000000', pincode: '1234' } as never),
      PhoneNotFoundException
    )
  })
})

test.group('Auth login | verify-account (OTP → token stampé)', (group) => {
  group.each.setup(async () => {
    await db.rawQuery('SET FOREIGN_KEY_CHECKS = 0')
    await db.beginGlobalTransaction()
    app.container.swap(OtpVerificationService, () => new PermissiveOtpVerification() as never)
    return async () => {
      app.container.restore(OtpVerificationService)
      await db.rollbackGlobalTransaction()
      await db.rawQuery('SET FOREIGN_KEY_CHECKS = 1')
    }
  })

  test('OTP correct → token émis, stampé app:aiglesend', async ({ assert }) => {
    const useCase = await app.container.make(VerifyAndAuthenticateUserAccountUseCase)
    const user = await makeUser('1234')

    const result = await useCase.execute(
      { country_id: 52, phone: user.phone, otp: '0000' } as never,
      'login'
    )
    assert.isDefined(result)

    const tokens = await User.accessTokens.all(user)
    assert.lengthOf(tokens, 1)
    assert.include(tokens[0].abilities, appAbility(AppName.AIGLESEND))
  })

  test('téléphone inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyAndAuthenticateUserAccountUseCase)
    await assert.rejects(
      () =>
        useCase.execute({ country_id: 52, phone: '225000000000', otp: '0000' } as never, 'login'),
      PhoneNotFoundException
    )
  })

  test('compte bloqué → AccountBlockedException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyAndAuthenticateUserAccountUseCase)
    const user = await makeUser('1234', UserStatus.BLOCKED)

    await assert.rejects(
      () => useCase.execute({ country_id: 52, phone: user.phone, otp: '0000' } as never, 'login'),
      AccountBlockedException
    )
  })
})
