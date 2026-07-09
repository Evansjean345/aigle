import { test } from '@japa/runner'
import { makeUser, authTestSetup, CHANNEL_WEB } from '#tests/helpers/auth_test_helpers'

/**
 * Caractérise le login business (Lot 2) : phone + PIN → OTP → token stampé
 * `app:aiglebusiness`, réutilisable sur les routes business. L'envoi SMS et la
 * vérification OTP réelle sont neutralisés (frontière core).
 */

test.group('Business auth | login', (group) => {
  group.each.setup(authTestSetup({ silentSms: true, permissiveOtp: true }))

  test('login PIN valide → OTP envoyé (200)', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: user.phone, pincode: '1234' })
    res.assertStatus(200)
  })

  test('login PIN invalide → rejet', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: user.phone, pincode: '9999' })
    res.assertStatus(401)
  })

  test('login phone inconnu → 401 (générique)', async ({ client }) => {
    const res = await client
      .post('/api/business/auth/login')
      .json({ phone: '225000000000', pincode: '1234' })
    res.assertStatus(401)
  })

  test('verify OTP → token stampé, utilisable sur une route business', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ pincode: '1234' })
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const verifyRes = await client
      .post('/api/business/auth/verify')
      .headers(CHANNEL_WEB)
      .json({ phone: user.phone, otp: '0000' })
    verifyRes.assertStatus(200)
    const token = verifyRes.body().token
    assert.isString(token)
    assert.equal(verifyRes.body().profile.userId, user.usersUid)

    // Le token stampé aiglebusiness passe requireApp('aiglebusiness').
    const orgRes = await client
      .get('/api/business/organisations')
      .header('Authorization', `Bearer ${token}`)
    orgRes.assertStatus(200)
  })
})
