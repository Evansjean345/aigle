import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import hash from '@adonisjs/core/services/hash'
import User from '#core/identity/user/domain/models/user'
import VerifyForgotPasswordOtpUseCase from '#core/identity/authentication/application/use_cases/verify_forgot_password_otp_use_case'
import ResetPasswordUseCase from '#core/identity/authentication/application/use_cases/reset_password_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import InvalidResetTokenException from '#core/identity/authentication/domain/exceptions/invalid_reset_token_exception'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, authTestSetup, CI_COUNTRY_ID } from '#tests/helpers/auth_test_helpers'

/**
 * Mot de passe oublié de bout en bout : verify-forgot-otp GÉNÈRE un reset_token
 * (après OTP), que reset-password CONSOMME pour changer le PIN et émettre un token
 * stampé app:aiglesend. OTP réel neutralisé. Pays 52 = CI (phone_code 225).
 */

test.group('Auth | forgot password', (group) => {
  group.each.setup(authTestSetup({ permissiveOtp: true }))

  test('verify-forgot-otp → renvoie un reset_token', async ({ assert }) => {
    const useCase = await app.container.make(VerifyForgotPasswordOtpUseCase)
    const user = await makeUser({ pincode: '1234' })

    const result = await useCase.execute({
      country_id: CI_COUNTRY_ID,
      phone: user.phone,
      otp: '0000',
    } as never)
    assert.isString(result.reset_token)
  })

  test('verify-forgot-otp numéro inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyForgotPasswordOtpUseCase)
    await assert.rejects(
      () =>
        useCase.execute({ country_id: CI_COUNTRY_ID, phone: '225000000000', otp: '0000' } as never),
      PhoneNotFoundException
    )
  })

  test('flux complet : le reset_token change le PIN + émet un token stampé', async ({ assert }) => {
    const verifyForgot = await app.container.make(VerifyForgotPasswordOtpUseCase)
    const resetPassword = await app.container.make(ResetPasswordUseCase)
    const user = await makeUser({ pincode: '1234' })

    const { reset_token } = await verifyForgot.execute({
      country_id: CI_COUNTRY_ID,
      phone: user.phone,
      otp: '0000',
    } as never)

    await resetPassword.execute({
      country_id: CI_COUNTRY_ID,
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
    const user = await makeUser({ pincode: '1234' })

    await assert.rejects(
      () =>
        resetPassword.execute({
          country_id: CI_COUNTRY_ID,
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
          country_id: CI_COUNTRY_ID,
          phone: '225000000000',
          reset_token: randomUUID(),
          new_pincode: '5678',
          confirm_pincode: '5678',
        } as never),
      UserAccountNotFoundException
    )
  })
})
