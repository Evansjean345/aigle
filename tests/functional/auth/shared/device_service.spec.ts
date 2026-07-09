import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import DeviceService from '#core/identity/device/application/services/device_service'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'
import { DeviceStatus } from '#core/identity/device/domain/enums'
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

test.group('DeviceService | trust', (group) => {
  group.each.setup(authTestSetup())

  test('appareil enregistré → trustDevice le promeut en TRUSTED', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    await service.saveDevice(deviceCommand(fp, uid), user.usersUid)
    const trusted = await service.trustDevice(user.usersUid, fp, uid)

    assert.isNotNull(trusted)
    assert.equal(trusted!.status, DeviceStatus.TRUSTED)
    assert.equal(trusted!.userId, user.usersUid)
  })

  test('deviceUid discordant → null (pas de confiance)', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()

    await service.saveDevice(deviceCommand(fp, randomUUID()), user.usersUid)
    const trusted = await service.trustDevice(user.usersUid, fp, 'un-autre-uid')

    assert.isNull(trusted)
  })

  test('appareil non enregistré → null', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()

    const trusted = await service.trustDevice(user.usersUid, randomUUID(), randomUUID())
    assert.isNull(trusted)
  })
})
