import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import UserDevice from '#core/identity/device/domain/models/user_device'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, authTestSetup, CHANNEL_WEB } from '#tests/helpers/auth_test_helpers'

/**
 * Login MOBILE business (décisions #10-#12) en DEUX temps (comme aiglesend) :
 * `device_info` au login → appareil PENDING ; `device_info` au verify → TRUSTED.
 * Scopé `app='aiglebusiness'`. Le web (sans device_info) n'en crée aucun.
 * SMS + OTP réels neutralisés.
 */

function devicePayload(fp: string, uid: string) {
  return {
    fingerprint_hash: fp,
    device_uid: uid,
    platform: 'android',
    is_emulator: false,
    is_rooted: false,
  }
}

test.group('Business auth | device trust (mobile, two-step)', (group) => {
  group.each.setup(authTestSetup({ silentSms: true, permissiveOtp: true }))

  test('login (body) → PENDING ; verify (headers) → TRUSTED (app=aiglebusiness)', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ pincode: '1234' })
    const fp = randomUUID()
    const uid = randomUUID()

    // Étape login (PIN) : canal mobile + device dans le BODY → appareil enregistré PENDING.
    await client
      .post('/api/business/auth/login')
      .header('X-Client-Channel', 'mobile')
      .json({ phone: user.phone, pincode: '1234', device_info: devicePayload(fp, uid) })

    const pending = await UserDevice.query().where('user_id', user.usersUid).firstOrFail()
    assert.equal(pending.app, AppName.AIGLEBUSINESS)
    assert.equal(pending.status, DeviceStatus.PENDING)

    // Étape verify (OTP) : canal mobile + device via HEADERS → même lien promu TRUSTED.
    const res = await client
      .post('/api/business/auth/verify')
      .headers({ 'X-Client-Channel': 'mobile', 'X-Device-Fingerprint': fp, 'X-Device-Uid': uid })
      .json({ phone: user.phone, otp: '0000' })
    res.assertStatus(200)

    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 1) // pas de doublon : le même lien est réutilisé
    assert.equal(links[0].status, DeviceStatus.TRUSTED)
  })

  test('device fourni seulement au login (OTP non complété) → reste PENDING', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ pincode: '1234' })
    const device = devicePayload(randomUUID(), randomUUID())

    await client
      .post('/api/business/auth/login')
      .header('X-Client-Channel', 'mobile')
      .json({ phone: user.phone, pincode: '1234', device_info: device })

    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 1)
    assert.equal(links[0].status, DeviceStatus.PENDING)
  })

  /** Login + verify mobile → renvoie {token, fp, uid} avec l'appareil TRUSTED. */
  async function loginTrustedMobile(client: any, phone: string) {
    const fp = randomUUID()
    const uid = randomUUID()
    await client
      .post('/api/business/auth/login')
      .header('X-Client-Channel', 'mobile')
      .json({ phone, pincode: '1234', device_info: devicePayload(fp, uid) })
    const verifyRes = await client
      .post('/api/business/auth/verify')
      .headers({ 'X-Client-Channel': 'mobile', 'X-Device-Fingerprint': fp, 'X-Device-Uid': uid })
      .json({ phone, otp: '0000' })
    return { token: verifyRes.body().token as string, fp, uid }
  }

  test('action mobile avec l’appareil de confiance → 200', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    const { token, fp, uid } = await loginTrustedMobile(client, user.phone)

    const res = await client
      .get('/api/business/organisations')
      .headers({ 'X-Client-Channel': 'mobile', 'X-Device-Fingerprint': fp, 'X-Device-Uid': uid })
      .header('Authorization', `Bearer ${token}`)
    res.assertStatus(200)
  })

  test('action mobile avec un appareil INCONNU → 401 (appareil non validé)', async ({ client }) => {
    const user = await makeUser({ pincode: '1234' })
    const { token } = await loginTrustedMobile(client, user.phone)

    // Mêmes token/canal mobile, mais headers d'un appareil qui n'existe pas.
    const res = await client
      .get('/api/business/organisations')
      .headers({
        'X-Client-Channel': 'mobile',
        'X-Device-Fingerprint': randomUUID(),
        'X-Device-Uid': randomUUID(),
      })
      .header('Authorization', `Bearer ${token}`)
    res.assertStatus(401)
    res.assertBodyContains({ code: 'E_UNAUTHENTICATED_DEVICE' })
  })

  test('login + verify SANS device_info (web) → aucun appareil', async ({ client, assert }) => {
    const user = await makeUser({ pincode: '1234' })

    await client
      .post('/api/business/auth/login')
      .headers(CHANNEL_WEB)
      .json({ phone: user.phone, pincode: '1234' })
    const res = await client
      .post('/api/business/auth/verify')
      .headers(CHANNEL_WEB)
      .json({ phone: user.phone, otp: '0000' })
    res.assertStatus(200)

    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 0)
  })
})
