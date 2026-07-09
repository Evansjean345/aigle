import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import OtpVerificationService from '#core/identity/otp/application/services/otp_verification_service'
import VerifyForgotPasswordOtpUseCase from '#core/identity/authentication/application/use_cases/verify_forgot_password_otp_use_case'
import ResetPasswordUseCase from '#core/identity/authentication/application/use_cases/reset_password_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import InvalidResetTokenException from '#core/identity/authentication/domain/exceptions/invalid_reset_token_exception'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'

/**
 * Mot de passe oublié de bout en bout : verify-forgot-otp GÉNÈRE un reset_token
 * (après OTP), que reset-password CONSOMME pour changer le PIN et émettre un token
 * stampé app:aiglesend. OTP réel neutralisé. Pays 52 = CI (phone_code 225).
 */

class PermissiveOtpVerification {
  async verify(): Promise<void> {}
}

async function makeUser(pin: string): Promise<User> {
  const user = new User()
  user.countryId = 52
  user.firstname = 'Forgot'
  user.lastname = 'User'
  user.phone = `225${Math.floor(1_00_000_000 + Math.random() * 8_99_999_999)}`
  user.status = UserStatus.ACTIVE
  user.accountType = 'freemium'
  user.pincode = pin
  await user.save()
  return user
}

test.group('Auth | forgot password', (group) => {
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

  test('verify-forgot-otp → renvoie un reset_token', async ({ assert }) => {
    const useCase = await app.container.make(VerifyForgotPasswordOtpUseCase)
    const user = await makeUser('1234')

    const result = await useCase.execute({
      country_id: 52,
      phone: user.phone,
      otp: '0000',
    } as never)
    assert.isString(result.reset_token)
  })

  test('verify-forgot-otp numéro inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyForgotPasswordOtpUseCase)
    await assert.rejects(
      () => useCase.execute({ country_id: 52, phone: '225000000000', otp: '0000' } as never),
      PhoneNotFoundException
    )
  })

  test('flux complet : le reset_token change le PIN + émet un token stampé', async ({ assert }) => {
    const verifyForgot = await app.container.make(VerifyForgotPasswordOtpUseCase)
    const resetPassword = await app.container.make(ResetPasswordUseCase)
    const user = await makeUser('1234')

    const { reset_token } = await verifyForgot.execute({
      country_id: 52,
      phone: user.phone,
      otp: '0000',
    } as never)

    await resetPassword.execute({
      country_id: 52,
      phone: user.phone,
      reset_token,
      new_pincode: '5678',
      confirm_pincode: '5678',
    } as never)

    const reloaded = await User.findByOrFail('usersUid', user.usersUid)
    assert.isTrue(await hash.verify(reloaded.pincode, '5678'))

    const tokens = await User.accessTokens.all(user)
    assert.include(tokens[0].abilities, appAbility(AppName.AIGLESEND))
  })

  test('reset-password token invalide → InvalidResetTokenException', async ({ assert }) => {
    const resetPassword = await app.container.make(ResetPasswordUseCase)
    const user = await makeUser('1234')

    await assert.rejects(
      () =>
        resetPassword.execute({
          country_id: 52,
          phone: user.phone,
          reset_token: randomUUID(),
          new_pincode: '5678',
          confirm_pincode: '5678',
        } as never),
      InvalidResetTokenException
    )
  })

  test('reset-password numéro inconnu → UserAccountNotFoundException', async ({ assert }) => {
    const resetPassword = await app.container.make(ResetPasswordUseCase)

    await assert.rejects(
      () =>
        resetPassword.execute({
          country_id: 52,
          phone: '225000000000',
          reset_token: randomUUID(),
          new_pincode: '5678',
          confirm_pincode: '5678',
        } as never),
      UserAccountNotFoundException
    )
  })
})
