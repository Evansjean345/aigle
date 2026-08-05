import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import UserDevice from '#core/identity/device/domain/models/user_device'
import DeviceService from '#core/identity/device/application/services/device_service'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import ListBusinessDevicesUseCase from '#aiglebusiness/device/application/use_cases/list_business_devices.use_case'
import { makeUser, authTestSetup } from '#tests/helpers/auth_test_helpers'

/**
 * Appareils du compte business : ce sont eux qui occupent le quota, et la liste est ce qui
 * permet à l'utilisateur de voir ce qu'il tient.
 */

function deviceCommand(fingerprint: string, uid: string, model: string): DeviceCommandDTO {
  const cmd = new DeviceCommandDTO()
  cmd.fingerprintHash = fingerprint
  cmd.deviceUid = uid
  cmd.platform = 'android'
  cmd.brand = 'Test'
  cmd.model = model
  cmd.osVersion = '14'
  cmd.appVersion = '1.0.0'
  cmd.isEmulator = false
  cmd.isRooted = false
  return cmd
}

test.group('Business appareils | liste', (group) => {
  group.each.setup(authTestSetup())

  test('ne liste que les appareils de l’app business', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(ListBusinessDevicesUseCase)
    const user = await makeUser()

    const businessFp = randomUUID()
    await service.saveDevice(
      deviceCommand(businessFp, randomUUID(), 'Business-1'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )
    await service.saveDevice(
      deviceCommand(randomUUID(), randomUUID(), 'Send-1'),
      user.usersUid,
      AppName.AIGLESEND
    )

    const devices = await useCase.execute(user.usersUid)

    assert.lengthOf(devices, 1)
    assert.equal(devices[0].model, 'Business-1')
  })

  test('marque l’appareil d’où vient la requête', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(ListBusinessDevicesUseCase)
    const user = await makeUser()

    const callerFp = randomUUID()
    await service.saveDevice(
      deviceCommand(callerFp, randomUUID(), 'Le mien'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )
    await service.saveDevice(
      deviceCommand(randomUUID(), randomUUID(), 'Un autre'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    const devices = await useCase.execute(user.usersUid, callerFp)
    const mine = devices.find((device) => device.model === 'Le mien')!
    const other = devices.find((device) => device.model === 'Un autre')!

    assert.isTrue(mine.current)
    assert.isFalse(other.current)

    // Depuis le web, aucun appareil n'est celui de l'appelant.
    const fromWeb = await useCase.execute(user.usersUid)
    assert.isTrue(fromWeb.every((device) => !device.current))
  })

  test('porte de quoi reconnaître l’appareil sans exposer son empreinte', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(ListBusinessDevicesUseCase)
    const user = await makeUser()

    const fingerprint = randomUUID()
    await service.saveDevice(
      deviceCommand(fingerprint, randomUUID(), 'Pixel 8'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    const [device] = await useCase.execute(user.usersUid)

    assert.equal(device.model, 'Pixel 8')
    assert.equal(device.brand, 'Test')
    assert.equal(device.platform, 'android')
    assert.equal(device.status, DeviceStatus.PENDING)
    assert.isTrue(device.isPrimary, 'le premier appareil lié est le principal')
    assert.isString(device.id)

    // L'empreinte et l'uid servent à s'authentifier : ils ne sortent pas.
    assert.notInclude(JSON.stringify(device), fingerprint)
  })

  test('un appareil délié disparaît de la liste', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(ListBusinessDevicesUseCase)
    const user = await makeUser()

    const fingerprint = randomUUID()
    const uid = randomUUID()
    await service.saveDevice(
      deviceCommand(fingerprint, uid, 'À retirer'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )
    await service.saveDevice(
      deviceCommand(randomUUID(), randomUUID(), 'Gardé'),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    const [toUnlink] = (await useCase.execute(user.usersUid)).filter(
      (device) => device.model === 'À retirer'
    )
 
    // Ce que posera le retrait (P2) : statut révoqué et lien daté.
    const link = await UserDevice.findOrFail(toUnlink.id)
    link.status = DeviceStatus.REVOKED
    link.unlinkedAt = DateTime.now()
    await link.save()

    const remaining = await useCase.execute(user.usersUid)
    assert.lengthOf(remaining, 1)
    assert.equal(remaining[0].model, 'Gardé')
  })
})