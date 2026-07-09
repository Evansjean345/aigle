import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import DeviceService from '#core/identity/device/application/services/device_service'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'
import { DeviceRequestDTO } from '#core/identity/device/application/dto/device.dto'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import UserDevice from '#core/identity/device/domain/models/user_device'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Gestion d'appareils mobile : `saveDevice` enregistre l'appareil (Device +
 * liaison user), `trustDevice` promeut une liaison EXISTANTE en TRUSTED. Un
 * appareil non enregistré ou un deviceUid discordant → null (pas de confiance).
 */

function deviceCommand(fingerprint: string, uid: string): DeviceCommandDTO {
  const cmd = new DeviceCommandDTO()
  cmd.fingerprintHash = fingerprint
  cmd.deviceUid = uid
  cmd.platform = 'android'
  cmd.brand = 'Test'
  cmd.model = 'T1'
  cmd.osVersion = '14'
  cmd.appVersion = '1.0.0'
  cmd.isEmulator = false
  cmd.isRooted = false
  return cmd
}

/** Forme requête brute (snake_case) attendue par register/trustForApp. */
function deviceRequest(fingerprint: string, uid: string): DeviceRequestDTO {
  const req = new DeviceRequestDTO()
  req.fingerprint_hash = fingerprint
  req.device_uid = uid
  req.platform = 'android'
  req.is_emulator = false
  req.is_rooted = false
  return req
}

test.group('DeviceService | trust', (group) => {
  group.each.setup(authTestSetup())

  test('appareil enregistré → trustDevice le promeut en TRUSTED', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLESEND)
    const trusted = await service.trustDevice(user.usersUid, fp, uid, undefined, AppName.AIGLESEND)

    assert.isNotNull(trusted)
    assert.equal(trusted!.status, DeviceStatus.TRUSTED)
    assert.equal(trusted!.userId, user.usersUid)
    assert.equal(trusted!.app, AppName.AIGLESEND)
  })

  test('deviceUid discordant → null (pas de confiance)', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()

    await service.saveDevice(deviceCommand(fp, randomUUID()), user.usersUid, AppName.AIGLESEND)
    const trusted = await service.trustDevice(
      user.usersUid,
      fp,
      'un-autre-uid',
      undefined,
      AppName.AIGLESEND
    )

    assert.isNull(trusted)
  })

  test('appareil non enregistré → null', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()

    const trusted = await service.trustDevice(
      user.usersUid,
      randomUUID(),
      randomUUID(),
      undefined,
      AppName.AIGLESEND
    )
    assert.isNull(trusted)
  })

  test('même user + même device, 2 apps → 2 liens indépendants (isolation par app)', async ({
    assert,
  }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    // API produit two-step (register PENDING au PIN, trust à l'OTP) pour les 2 apps.
    await service.registerForApp(deviceRequest(fp, uid), user.usersUid, AppName.AIGLESEND)
    const s = await service.trustForApp(deviceRequest(fp, uid), user.usersUid, AppName.AIGLESEND)
    await service.registerForApp(deviceRequest(fp, uid), user.usersUid, AppName.AIGLEBUSINESS)
    const b = await service.trustForApp(
      deviceRequest(fp, uid),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    assert.isNotNull(s)
    assert.isNotNull(b)
    assert.notEqual(s!.userDeviceId, b!.userDeviceId)

    // Deux liens user_device (un par app) pour le même (user, device).
    const links = await UserDevice.query().where('user_id', user.usersUid)
    assert.lengthOf(links, 2)
    assert.sameMembers(
      links.map((l) => l.app),
      [AppName.AIGLESEND, AppName.AIGLEBUSINESS]
    )
  })
})
