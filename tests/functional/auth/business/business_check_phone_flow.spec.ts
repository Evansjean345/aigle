import { test } from '@japa/runner'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Étape 0 du login business : check-phone. User Aigle KYC-vérifié → 200 (numéro
 * masqué, pas de PII) ; pas de compte Aigle → 404 ; KYC non validé → 403.
 */

const CHECK = '/api/business/auth/check-phone'

test.group('Business auth | check-phone', (group) => {
  group.each.setup(authTestSetup())

  test('user Aigle KYC-vérifié → 200, numéro masqué (sans nom)', async ({ client, assert }) => {
    const user = await makeUser()
    user.kycStatus = UserKycStatus.VERIFIED
    await user.save()

    const res = await client.post(CHECK).json({ phone: user.phone })
    res.assertStatus(200)
    assert.isString(res.body().phone)
    assert.notProperty(res.body(), 'firstname') // pas de PII
    assert.notEqual(res.body().phone, user.phone) // masqué
  })

  test('numéro sans compte Aigle → 404', async ({ client }) => {
    const res = await client.post(CHECK).json({ phone: '225000000000' })
    res.assertStatus(404)
    res.assertBodyContains({ code: 'E_NOT_AIGLE_USER' })
  })

  test('user Aigle mais KYC non validé → 403', async ({ client }) => {
    const user = await makeUser()
    user.kycStatus = UserKycStatus.PENDING_IN_REVIEW
    await user.save()

    const res = await client.post(CHECK).json({ phone: user.phone })
    res.assertStatus(403)
    res.assertBodyContains({ code: 'E_KYC_NOT_VERIFIED' })
  })
})
