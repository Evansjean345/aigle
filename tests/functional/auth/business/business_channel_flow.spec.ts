import { test } from '@japa/runner'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Middleware device BUSINESS (channel-aware) sur `/business/auth/verify` : le canal
 * (`X-Client-Channel`) est obligatoire ; le canal `mobile` exige les headers device ;
 * `web` non. Le canal est stampé sur le token et exposé dans les sessions.
 * SMS + OTP réels neutralisés.
 */

const VERIFY = '/api/business/auth/verify'

test.group('Business auth | canal (channel-aware device)', (group) => {
  group.each.setup(authTestSetup({ silentSms: true, permissiveOtp: true }))

  test('verify sans X-Client-Channel → 400', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const res = await client.post(VERIFY).json({ phone: user.phone, otp: '0000' })
    res.assertStatus(400)
    res.assertBodyContains({ code: 'E_CHANNEL_REQUIRED' })
  })

  test('canal mobile SANS headers device → 400', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const res = await client
      .post(VERIFY)
      .headers({ 'X-Client-Channel': 'mobile' })
      .json({ phone: user.phone, otp: '0000' })
    res.assertStatus(400)
    res.assertBodyContains({ code: 'E_DEVICE_REQUIRED' })
  })

  test('canal invalide → 400', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const res = await client
      .post(VERIFY)
      .headers({ 'X-Client-Channel': 'desktop' })
      .json({ phone: user.phone, otp: '0000' })
    res.assertStatus(400)
  })

  test('canal web → token stampé channel:web, exposé dans les sessions', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ pincode: '1234' })
    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })

    const verifyRes = await client
      .post(VERIFY)
      .headers({ 'X-Client-Channel': 'web' })
      .json({ phone: user.phone, otp: '0000' })
    verifyRes.assertStatus(200)
    const token = verifyRes.body().token

    const sessions = await client
      .get('/api/business/auth/sessions')
      .header('Authorization', `Bearer ${token}`)
    sessions.assertStatus(200)
    const current = sessions.body().find((s: { current: boolean }) => s.current)
    assert.equal(current.channel, 'web')
  })
})
