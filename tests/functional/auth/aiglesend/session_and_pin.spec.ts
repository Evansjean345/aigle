import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { UserStatus } from '#core/identity/user/domain/enum'
import CheckPinUseCase from '#core/identity/authentication/application/use_cases/check_pin_use_case'
import GetSessionStatusUseCase from '#core/identity/authentication/application/use_cases/get_session_status_use_case'
import GetUserProfileUseCase from '#core/identity/authentication/application/use_cases/get_user_profile_use_case'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import InvalidPincodeException from '#core/identity/authentication/domain/exceptions/invalid_pincode_exception'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Vérification de PIN (écran de confirmation), statut de session et profil de
 * l'utilisateur authentifié. Ces use cases opèrent sur un user déjà connu / résolu.
 */

test.group('Auth | check-pin', (group) => {
  group.each.setup(authTestSetup())

  test('PIN correct → true', async ({ assert }) => {
    const useCase = await app.container.make(CheckPinUseCase)
    const user = await makeUser({ pincode: '1234' })

    const ok = await useCase.execute({ phone: user.phone, pincode: '1234' } as never)
    assert.isTrue(ok)
  })

  test('PIN incorrect → InvalidPincodeException', async ({ assert }) => {
    const useCase = await app.container.make(CheckPinUseCase)
    const user = await makeUser({ pincode: '1234' })

    await assert.rejects(
      () => useCase.execute({ phone: user.phone, pincode: '0000' } as never),
      InvalidPincodeException
    )
  })

  test('numéro inconnu → UserAccountNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(CheckPinUseCase)
    await assert.rejects(
      () => useCase.execute({ phone: '225000000000', pincode: '1234' } as never),
      UserAccountNotFoundException
    )
  })
})

test.group('Auth | session status & profil', (group) => {
  group.each.setup(authTestSetup())

  test('utilisateur actif → session non verrouillée', async ({ assert }) => {
    const useCase = await app.container.make(GetSessionStatusUseCase)
    const user = await makeUser()

    const status = await useCase.execute(user)
    assert.isFalse(status.locked)
  })

  test('utilisateur bloqué → session verrouillée (ACCOUNT_BLOCKED)', async ({ assert }) => {
    const useCase = await app.container.make(GetSessionStatusUseCase)
    const user = await makeUser({ status: UserStatus.BLOCKED })

    const status = await useCase.execute(user)
    assert.isTrue(status.locked)
    assert.equal(status.reason, 'ACCOUNT_BLOCKED')
  })

  test('get-user-profile → renvoie l’utilisateur authentifié', async ({ assert }) => {
    const useCase = await app.container.make(GetUserProfileUseCase)
    const user = await makeUser()

    const profile = await useCase.execute(user)
    assert.equal(profile.usersUid, user.usersUid)
  })
})
