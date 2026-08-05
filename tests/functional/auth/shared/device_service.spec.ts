import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import DeviceService from '#core/identity/device/application/services/device_service'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'
import {
  DeviceRequestDTO,
  DeviceResponseDTO,
} from '#core/identity/device/application/dto/device.dto'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { AppName, appAbility } from '#core/identity/authentication/domain/enums/app_name'
import UserDevice from '#core/identity/device/domain/models/user_device'
import User from '#core/identity/user/domain/models/user'
import RevokeUserDeviceUseCase from '#core/identity/device/application/use_cases/admin/revoke_user_device_use_case'
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

    await service.registerForApp(deviceRequest(fp, uid), user.usersUid, AppName.AIGLESEND)
    const s = await service.trustForApp(fp, uid, user.usersUid, AppName.AIGLESEND)
    await service.registerForApp(deviceRequest(fp, uid), user.usersUid, AppName.AIGLEBUSINESS)
    const b = await service.trustForApp(fp, uid, user.usersUid, AppName.AIGLEBUSINESS)

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

  test('getActiveUserDevices scopé par app (aiglesend ne voit pas business)', async ({
    assert,
  }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()

    // Un appareil aiglesend + un appareil business (fingerprints distincts).
    await service.registerForApp(
      deviceRequest(randomUUID(), randomUUID()),
      user.usersUid,
      AppName.AIGLESEND
    )
    await service.registerForApp(
      deviceRequest(randomUUID(), randomUUID()),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    const sendDevices = await service.getActiveUserDevices(user.usersUid, AppName.AIGLESEND)
    assert.lengthOf(sendDevices, 1)
    assert.equal(sendDevices[0].app, AppName.AIGLESEND)

    const bizDevices = await service.getActiveUserDevices(user.usersUid, AppName.AIGLEBUSINESS)
    assert.lengthOf(bizDevices, 1)
    assert.equal(bizDevices[0].app, AppName.AIGLEBUSINESS)

    // Sans app → tous (admin/back-office).
    const all = await service.getActiveUserDevices(user.usersUid)
    assert.lengthOf(all, 2)
  })
})

test.group('DeviceService | assertTrustedForApp', (group) => {
  group.each.setup(authTestSetup())

  test('appareil TRUSTED → résout (aucune exception)', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLESEND)
    await service.trustDevice(user.usersUid, fp, uid, undefined, AppName.AIGLESEND)

    await assert.doesNotReject(() =>
      service.assertTrustedForApp(user.usersUid, fp, uid, AppName.AIGLESEND, 'android')
    )
  })

  test('appareil PENDING (non trusté) → NOT_TRUSTED_DEVICE', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    // Enregistré mais pas trusté (reste PENDING).
    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLESEND)

    await assert.rejects(
      () => service.assertTrustedForApp(user.usersUid, fp, uid, AppName.AIGLESEND),
      /autoris/i
    )
  })

  test('appareil inconnu → E_UNAUTHENTICATED_DEVICE', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()

    await assert.rejects(() =>
      service.assertTrustedForApp(user.usersUid, randomUUID(), randomUUID(), AppName.AIGLESEND)
    )
  })

  test('appareil rooté/émulateur → E_UNSECURE_DEVICE', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    const cmd = deviceCommand(fp, uid)
    cmd.isRooted = true
    await service.saveDevice(cmd, user.usersUid, AppName.AIGLESEND)
    await service.trustDevice(user.usersUid, fp, uid, undefined, AppName.AIGLESEND)

    await assert.rejects(
      () => service.assertTrustedForApp(user.usersUid, fp, uid, AppName.AIGLESEND, 'android'),
      /sécuris|UNSECURE|rooté|émulateur/i
    )
  })

  test('incohérence de plateforme → E_PLATFORM_MISMATCH', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    // Enregistré en 'android' puis trusté ; requête déclarant 'ios' → mismatch.
    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLESEND)
    await service.trustDevice(user.usersUid, fp, uid, undefined, AppName.AIGLESEND)

    await assert.rejects(
      () => service.assertTrustedForApp(user.usersUid, fp, uid, AppName.AIGLESEND, 'ios'),
      /plateforme|PLATFORM/i
    )
  })
})

test.group('DeviceService | révocation back-office', (group) => {
  group.each.setup(authTestSetup())

  test('révoquer un appareil coupe toutes ses apps', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(RevokeUserDeviceUseCase)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    // Un même téléphone, une liaison par app.
    const sendLink = await service.saveDevice(
      deviceCommand(fp, uid),
      user.usersUid,
      AppName.AIGLESEND
    )
    const businessLink = await service.saveDevice(
      deviceCommand(fp, uid),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )
    assert.notEqual(sendLink.id, businessLink.id)
    assert.equal(sendLink.deviceId, businessLink.deviceId)

    await useCase.execute(user.usersUid, sendLink.deviceId)

    const remaining = await service.getActiveUserDevices(user.usersUid)
    assert.lengthOf(remaining, 0, 'aucune app ne survit à la révocation')
  })

  test('les sessions des liaisons révoquées tombent', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const useCase = await app.container.make(RevokeUserDeviceUseCase)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    const sendLink = await service.saveDevice(
      deviceCommand(fp, uid),
      user.usersUid,
      AppName.AIGLESEND
    )
    const businessLink = await service.saveDevice(
      deviceCommand(fp, uid),
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    for (const link of [sendLink, businessLink]) {
      await User.accessTokens.create(user, [appAbility(link.app as AppName)], {
        name: `device:${link.id}`,
      })
    }
    // Une session sans rapport avec cet appareil, qui doit survivre.
    await User.accessTokens.create(user, [appAbility(AppName.AIGLESEND)], { name: 'web-session' })

    await useCase.execute(user.usersUid, sendLink.deviceId)

    const tokens = await User.accessTokens.all(user)
    assert.deepEqual(
      tokens.map((token) => token.name),
      ['web-session']
    )
  })

  test('un appareil sans liaison active → introuvable', async ({ assert }) => {
    const useCase = await app.container.make(RevokeUserDeviceUseCase)
    const user = await makeUser()

    await assert.rejects(() => useCase.execute(user.usersUid, randomUUID()), /trouv/i)
  })
})

test.group('DeviceService | distinction des apps', (group) => {
  group.each.setup(authTestSetup())

  test('les liaisons d’un même appareil portent leur app', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()
    const fp = randomUUID()
    const uid = randomUUID()

    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLESEND)
    await service.saveDevice(deviceCommand(fp, uid), user.usersUid, AppName.AIGLEBUSINESS)

    const links = await service.getActiveUserDevices(user.usersUid)
    const projected = links.map((link) => DeviceResponseDTO.fromUserDevice(link))

    // Même marque, même modèle : sans `app`, les deux lignes sont indiscernables.
    assert.lengthOf(projected, 2)
    assert.sameMembers(
      projected.map((device) => device.app),
      [AppName.AIGLESEND, AppName.AIGLEBUSINESS]
    )
    assert.equal(projected[0].model, projected[1].model)
  })
})

test.group('DeviceService | collision d’empreinte', (group) => {
  group.each.setup(authTestSetup())

  test('une empreinte tenue par un autre compte ne déloge pas son titulaire', async ({
    assert,
  }) => {
    const service = await app.container.make(DeviceService)
    const owner = await makeUser()
    const intruder = await makeUser()

    const sharedFingerprint = randomUUID()
    const ownerUid = randomUUID()
    const intruderUid = randomUUID()

    await service.saveDevice(
      deviceCommand(sharedFingerprint, ownerUid),
      owner.usersUid,
      AppName.AIGLESEND
    )
    await service.trustDevice(
      owner.usersUid,
      sharedFingerprint,
      ownerUid,
      undefined,
      AppName.AIGLESEND
    )

    await service.saveDevice(
      deviceCommand(sharedFingerprint, intruderUid),
      intruder.usersUid,
      AppName.AIGLESEND
    )

    // Le titulaire garde son appareil.
    await assert.doesNotReject(() =>
      service.assertTrustedForApp(
        owner.usersUid,
        sharedFingerprint,
        ownerUid,
        AppName.AIGLESEND,
        'android'
      )
    )

    // Et les deux comptes ne partagent pas la même ligne.
    const ownerDevices = await service.getActiveUserDevices(owner.usersUid)
    const intruderDevices = await service.getActiveUserDevices(intruder.usersUid)
    assert.notEqual(ownerDevices[0].deviceId, intruderDevices[0].deviceId)
  })

  test('le même utilisateur qui réinstalle reprend sa ligne', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const user = await makeUser()

    const fingerprint = randomUUID()
    const before = await service.saveDevice(
      deviceCommand(fingerprint, randomUUID()),
      user.usersUid,
      AppName.AIGLESEND
    )

    // Réinstallation : l'empreinte matérielle est stable, l'uid d'installation est régénéré.
    const after = await service.saveDevice(
      deviceCommand(fingerprint, randomUUID()),
      user.usersUid,
      AppName.AIGLESEND
    )

    assert.equal(after.deviceId, before.deviceId, "l'historique de l'appareil est conservé")

    const devices = await service.getActiveUserDevices(user.usersUid)
    assert.lengthOf(devices, 1, 'aucune ligne en double')
  })

  test('une empreinte libre est reprise, pas dupliquée', async ({ assert }) => {
    const service = await app.container.make(DeviceService)
    const owner = await makeUser()
    const newcomer = await makeUser()

    const fingerprint = randomUUID()
    const first = await service.saveDevice(
      deviceCommand(fingerprint, randomUUID()),
      owner.usersUid,
      AppName.AIGLESEND
    )

    // Plus personne ne tient la ligne : le titulaire s'est retiré.
    const link = await UserDevice.findOrFail(first.id)
    link.unlinkedAt = DateTime.now()
    await link.save()

    const second = await service.saveDevice(
      deviceCommand(fingerprint, randomUUID()),
      newcomer.usersUid,
      AppName.AIGLESEND
    )

    assert.equal(second.deviceId, first.deviceId)
  })
})
