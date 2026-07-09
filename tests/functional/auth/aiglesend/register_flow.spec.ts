import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import User from '#core/identity/user/domain/models/user'
import { UserStatus } from '#core/identity/user/domain/enum'
import RegisterUseCase from '#core/identity/authentication/application/use_cases/register_use_case'
import UserAlreadyExistsException from '#core/identity/authentication/domain/exceptions/user_already_exists_exception'
import { authTestSetup, CI_COUNTRY_ID } from '#tests/helpers/auth_test_helpers'

/**
 * Inscription mobile aiglesend : crée un utilisateur INACTIVE + son compte, puis
 * déclenche l'OTP de vérification. Un téléphone déjà pris → UserAlreadyExists.
 * SMS neutralisé (frontière core). Pays 52 = CI (phone_code 225).
 */

function registerPayload(localPhone: string) {
  return {
    country_id: CI_COUNTRY_ID,
    phone: localPhone,
    firstname: 'New',
    lastname: 'User',
    pincode: '1234',
  } as never
}

test.group('Auth | register', (group) => {
  group.each.setup(authTestSetup({ silentSms: true }))

  test('nouveau numéro → crée un utilisateur INACTIVE', async ({ assert }) => {
    const useCase = await app.container.make(RegisterUseCase)
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))

    const result = await useCase.execute(registerPayload(local))
    assert.isDefined(result)

    const created = await User.findBy('phone', `225${local}`)
    assert.isNotNull(created)
    assert.equal(created!.status, UserStatus.INACTIVE)
  })

  test('numéro déjà pris → UserAlreadyExistsException', async ({ assert }) => {
    const useCase = await app.container.make(RegisterUseCase)
    const local = String(Math.floor(7_00_000_000 + Math.random() * 99_999_999))

    await useCase.execute(registerPayload(local))
    await assert.rejects(() => useCase.execute(registerPayload(local)), UserAlreadyExistsException)
  })
})
