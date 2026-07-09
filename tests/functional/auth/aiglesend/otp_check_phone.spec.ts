import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import SendOtpUseCase from '#core/identity/authentication/application/use_cases/send_otp_use_case'
import CheckPhoneUseCase from '#core/identity/authentication/application/use_cases/check_phone_use_case'
import PhoneNotFoundException from '#core/identity/authentication/domain/exceptions/phone_not_found_exception'
import { makeUser, authTestSetup, CI_COUNTRY_ID } from '#tests/helpers/auth_test_helpers'

/**
 * Envoi d'OTP (utilisé aussi par forgot-password/request) et vérification
 * d'existence d'un numéro : numéro connu → OTP envoyé / numéro renvoyé ; inconnu
 * → PhoneNotFound. SMS neutralisé. Pays 52 = CI (phone_code 225).
 */

test.group('Auth | send-otp', (group) => {
  group.each.setup(authTestSetup({ silentSms: true }))

  test('numéro connu → OTP envoyé', async ({ assert }) => {
    const useCase = await app.container.make(SendOtpUseCase)
    const user = await makeUser()

    const result = await useCase.execute({ phone: user.phone, country_id: CI_COUNTRY_ID } as never)
    assert.isTrue(result.sent)
  })

  test('numéro inconnu → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(SendOtpUseCase)
    await assert.rejects(
      () => useCase.execute({ phone: '225000000000', country_id: CI_COUNTRY_ID } as never),
      PhoneNotFoundException
    )
  })
})

test.group('Auth | check-phone', (group) => {
  group.each.setup(authTestSetup())

  test('numéro existant → renvoie le numéro formaté', async ({ assert }) => {
    const useCase = await app.container.make(CheckPhoneUseCase)
    const user = await makeUser()

    const result = await useCase.execute(user.phone, CI_COUNTRY_ID)
    assert.equal(result.phone, user.phone)
  })

  test('numéro inexistant → PhoneNotFoundException', async ({ assert }) => {
    const useCase = await app.container.make(CheckPhoneUseCase)
    await assert.rejects(
      () => useCase.execute('225000000000', CI_COUNTRY_ID),
      PhoneNotFoundException
    )
  })
})
