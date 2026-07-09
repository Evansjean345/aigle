import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import VerifyCredentialsUseCase from '#core/identity/authentication/application/use_cases/verify_credentials_use_case'
import VerifyAndAuthenticateUserAccountUseCase from '#core/identity/authentication/application/use_cases/verify_and_authenticate_user_account_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import AccountBlockedException from '#core/identity/authentication/domain/exceptions/account_blocked_exception'
import { appAbility, AppName } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, authTestSetup, CI_COUNTRY_ID } from '#tests/helpers/auth_test_helpers'

/**
 * Login mobile aiglesend au niveau des use cases (le vrai chemin, sans le HTTP) :
 * verify-credentials (PIN → OTP) puis verify-account (OTP → token stampé
 * app:aiglesend). SMS et vérification OTP réelle neutralisés (frontières core).
 */

test.group('Auth login | verify-credentials (PIN → OTP)', (group) => {
  group.each.setup(authTestSetup({ silentSms: true }))

  test('PIN correct → envoie l’OTP (résout)', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    const user = await makeUser({ pincode: '1234' })

    await assert.doesNotReject(() =>
      useCase.execute({ country_id: CI_COUNTRY_ID, phone: user.phone, pincode: '1234' } as never)
    )
  })

  test('PIN incorrect → InvalidPincodeException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    const user = await makeUser({ pincode: '1234' })

    await assert.rejects(
      () =>
        useCase.execute({ country_id: CI_COUNTRY_ID, phone: user.phone, pincode: '0000' } as never),
      InvalidPincodeException
    )
  })

  test('téléphone inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyCredentialsUseCase)
    await assert.rejects(
      () =>
        useCase.execute({
          country_id: CI_COUNTRY_ID,
          phone: '225000000000',
          pincode: '1234',
        } as never),
      PhoneNotFoundException
    )
  })
})

test.group('Auth login | verify-account (OTP → token stampé)', (group) => {
  group.each.setup(authTestSetup({ permissiveOtp: true }))

  test('OTP correct → token émis, stampé app:aiglesend', async ({ assert }) => {
    const useCase = await app.container.make(VerifyAndAuthenticateUserAccountUseCase)
    const user = await makeUser({ pincode: '1234' })

    const result = await useCase.execute(
      { country_id: CI_COUNTRY_ID, phone: user.phone, otp: '0000' } as never,
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
        useCase.execute(
          { country_id: CI_COUNTRY_ID, phone: '225000000000', otp: '0000' } as never,
          'login'
        ),
      PhoneNotFoundException
    )
  })

  test('compte bloqué → AccountBlockedException', async ({ assert }) => {
    const useCase = await app.container.make(VerifyAndAuthenticateUserAccountUseCase)
    const user = await makeUser({ pincode: '1234', status: UserStatus.BLOCKED })

    await assert.rejects(
      () =>
        useCase.execute(
          { country_id: CI_COUNTRY_ID, phone: user.phone, otp: '0000' } as never,
          'login'
        ),
      AccountBlockedException
    )
  })
})
