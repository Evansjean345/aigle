import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import UserDevice from '#core/identity/device/domain/models/user_device'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Login MOBILE business (décision #10) : quand `device_info` est fourni à l'étape
 * verify, l'appareil est enregistré + trusté, scopé `app='aiglebusiness'`. Le web
 * (sans device_info) n'en crée aucun. SMS + OTP réels neutralisés.
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

test.group('Business auth | device trust (mobile)', (group) => {
  group.each.setup(authTestSetup({ silentSms: true, permissiveOtp: true }))

  test('verify avec device_info → appareil trusté app=aiglebusiness', async ({
    client,
    assert,
  }) => {
    const user = await makeUser({ pincode: '1234' })
    const fp = randomUUID()
    const uid = randomUUID()

    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })
    const res = await client
      .post('/api/business/auth/verify')
      .json({ phone: user.phone, otp: '0000', device_info: devicePayload(fp, uid) })
    res.assertStatus(200)

    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 1)
    assert.equal(links[0].app, AppName.AIGLEBUSINESS)
    assert.equal(links[0].status, DeviceStatus.TRUSTED)
  })

  test('verify SANS device_info (web) → aucun appareil créé', async ({ client, assert }) => {
    const user = await makeUser({ pincode: '1234' })

    await client.post('/api/business/auth/login').json({ phone: user.phone, pincode: '1234' })
    const res = await client
      .post('/api/business/auth/verify')
      .json({ phone: user.phone, otp: '0000' })
    res.assertStatus(200)

    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 0)
  })
})
