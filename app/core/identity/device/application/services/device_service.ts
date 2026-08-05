import { inject } from '@adonisjs/core'
import adonisApp from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import DeviceRepository from '#core/identity/device/domain/interfaces/device_repository'
import UserDeviceRepository from '#core/identity/device/domain/interfaces/user_device_repository'
import UserDevice from '#core/identity/device/domain/models/user_device'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import { DeviceCommandDTO } from '#core/identity/device/application/dto/device.command.dto'
import { type DeviceRequestDTO } from '#core/identity/device/application/dto/device.dto'
import { type UserDeviceResult } from '#core/identity/device/application/dto/user_device_result'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import NewDeviceDetected from '#core/identity/device/application/events/new_device_detected'
import { maxDeviceConnectionAllowed } from '#config/app'
import appLog from '#shared/infrastructure/logging/app_log'
import { Exception } from '@adonisjs/core/exceptions'
import FailedToSaveOrUpdateDeviceException from '#core/identity/device/domain/exceptions/failed_to_save_or_update_device_exception'
import UnauthenticatedDeviceException from '#core/identity/device/domain/exceptions/unauthenticated_device_exception'
import NotTrustedDeviceException from '#core/identity/device/domain/exceptions/not_trusted_device_exception'
import FailedToUpdatePushTokenException from '#core/identity/device/domain/exceptions/failed_to_update_push_token_exception'
import MaxDevicesConnectedException from '#core/identity/device/domain/exceptions/max_devices_connected_exception'

import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * @class DeviceService
 * Service interne pour la gestion des devices, utilisé par d'autres parties de l'application.
 */
@inject()
export default class DeviceService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly userDeviceRepository: UserDeviceRepository
  ) {}

  /**
   * Récupère les associations actives (avec device preloaded) pour un utilisateur.
   */
  async getActiveUserDevices(userId: string, app?: string): Promise<UserDevice[]> {
    return this.userDeviceRepository.findActiveByUserId(userId, app)
  }

  /**
   * Liste les appareils liés à un utilisateur pour une app. API PRODUIT : ne renvoie pas le
   * modèle `UserDevice` (invariant produit→core).
   *
   * Les plus récemment vus d'abord — l'appareil qu'on cherche à retirer est rarement celui
   * qu'on utilise.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @param {string} app - App dont on liste les appareils.
   * @param {string} [currentFingerprintHash] - Empreinte de l'appareil appelant, marqué `current`.
   * @returns {Promise<UserDeviceResult[]>} Les appareils liés, du plus récemment vu au plus ancien.
   */
  async listForApp(
    userId: string,
    app: string,
    currentFingerprintHash?: string
  ): Promise<UserDeviceResult[]> {
    const userDevices = await this.userDeviceRepository.findActiveByUserId(userId, app)

    return userDevices
      .sort((a, b) => (b.lastSeenAt?.toMillis() ?? 0) - (a.lastSeenAt?.toMillis() ?? 0))
      .map((userDevice) => ({
        id: userDevice.id,
        brand: userDevice.device?.brand ?? null,
        model: userDevice.device?.model ?? null,
        platform: userDevice.device?.platform ?? null,
        appVersion: userDevice.device?.appVersion ?? null,
        status: userDevice.status,
        // `tinyint` rendu en 0/1 par le driver, que le modèle déclare pourtant booléen.
        isPrimary: Boolean(userDevice.isPrimary),
        linkedAt: userDevice.linkedAt?.toISO() ?? null,
        lastSeenAt: userDevice.lastSeenAt?.toISO() ?? null,
        lastCountryCode: userDevice.lastCountryCode ?? null,
        current:
          currentFingerprintHash !== undefined &&
          userDevice.device?.fingerprintHash === currentFingerprintHash,
      }))
  }

  /**
   * Récupère les associations actives trusted pour un utilisateur (scopées par app
   * si fourni).
   */
  async getTrustedDevices(userId: string, app?: string): Promise<UserDevice[]> {
    const userDevices = await this.userDeviceRepository.findActiveByUserId(userId, app)
    return userDevices.filter((ud) => ud.status === DeviceStatus.TRUSTED)
  }

  /**
   * Vérifie si le quota max de devices actifs est atteint pour un utilisateur.
   */
  async checkIfMaxConnectionReached(userId: string, app: string): Promise<boolean> {
    const count = await this.userDeviceRepository.countActiveByUserAndStatuses(
      userId,
      [DeviceStatus.TRUSTED, DeviceStatus.PENDING],
      app
    )
    return count >= maxDeviceConnectionAllowed
  }

  /**
   * Marque un device comme trusted pour un utilisateur après validation OTP.
   * Retourne le UserDevice mis à jour ou null si non trouvé.
   */
  async trustDevice(
    userId: string,
    fingerprintHash: string,
    deviceUid: string,
    geoLocation: GeoIpLocation | undefined,
    app: string
  ): Promise<UserDevice | null> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (!device || device.deviceUid !== deviceUid) {
      return null
    }

    const userDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
      userId,
      device.id,
      app
    )

    if (!userDevice) {
      return null
    }

    userDevice.status = DeviceStatus.TRUSTED
    userDevice.lastSeenAt = DateTime.now()

    if (geoLocation) {
      userDevice.ipLastSeen = geoLocation.ip
      userDevice.isVpn = geoLocation.isVpn
      userDevice.lastCountryCode = geoLocation.countryCode
      userDevice.firstCountryCode = userDevice.firstCountryCode ?? geoLocation.countryCode
    }

    return this.userDeviceRepository.save(userDevice)
  }

  /**
   * Enregistre ou met à jour un device pour un utilisateur.
   * - Crée le Device (hardware) s'il n'existe pas
   * - Crée ou met à jour la liaison UserDevice
   * - Vérifie le quota
   * - Émet NewDeviceDetected si nouvelle association
   */
  async saveDevice(payload: DeviceCommandDTO, userId: string, app: string): Promise<UserDevice> {
    try {
      // 1. Trouver ou créer le device hardware
      const device = await this.deviceRepository.updateOrCreateByFingerprintHash(
        payload.fingerprintHash,
        {
          deviceUid: payload.deviceUid,
          platform: payload.platform,
          brand: payload.brand,
          model: payload.model,
          osVersion: payload.osVersion,
          appVersion: payload.appVersion,
          isEmulator: payload.isEmulator,
          isRooted: payload.isRooted,
        }
      )

      // 2. Chercher une liaison active existante (scopée à l'app)
      const existingUserDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
        userId,
        device.id,
        app
      )

      if (existingUserDevice) {
        // Mise à jour de la liaison existante
        existingUserDevice.lastSeenAt = DateTime.now()
        existingUserDevice.ipLastSeen = payload.ipLastSeen
        existingUserDevice.lastCountryCode = payload.lastCountryCode
        existingUserDevice.isVpn = payload.isVpn || false

        return this.userDeviceRepository.save(existingUserDevice)
      }

      // 3. Nouvelle association — vérifier le quota (par app)
      await this.ensureMaxDevicesNotReached(userId, app)

      // 4. Déterminer si primary (par app)
      const activeCount = await this.userDeviceRepository.countActiveByUserId(userId, app)
      const shouldBePrimary = activeCount === 0

      // 5. Créer la nouvelle liaison
      const userDevice = new UserDevice()
      userDevice.userId = userId
      userDevice.deviceId = device.id
      userDevice.app = app
      userDevice.status = DeviceStatus.PENDING
      userDevice.isPrimary = shouldBePrimary
      userDevice.ipFirstSeen = payload.ipFirstSeen
      userDevice.ipLastSeen = payload.ipLastSeen
      userDevice.isVpn = payload.isVpn || false
      userDevice.firstCountryCode = payload.firstCountryCode
      userDevice.lastCountryCode = payload.lastCountryCode
      userDevice.linkedAt = DateTime.now()
      userDevice.lastSeenAt = DateTime.now()

      const savedUserDevice = await this.userDeviceRepository.save(userDevice)

      // 6. Notification nouveau device (scopée à l'app)
      await NewDeviceDetected.dispatch(userId, device, app)

      return savedUserDevice
    } catch (error) {
      if (error instanceof MaxDevicesConnectedException) {
        throw error
      }

      appLog.error(
        'FAILED_TO_SAVE_OR_UPDATE_DEVICE',
        { fingerprintHash: payload.fingerprintHash, error: error },
        `Failed to save or update device: ${error.message}`
      )
      throw new FailedToSaveOrUpdateDeviceException()
    }
  }

  /**
   * Enregistre un appareil en **PENDING** pour une app donnée (étape PIN du login,
   * comme aiglesend `verify-credentials`) : émet `NewDeviceDetected` sur un nouvel
   * appareil. Ne truste PAS. API PRODUIT : ne renvoie/expose pas le modèle `UserDevice`
   * (invariant produit→core).
   */
  async registerForApp(
    deviceRequest: DeviceRequestDTO,
    userId: string,
    app: string
  ): Promise<void> {
    await this.saveDevice(DeviceCommandDTO.fromRequest(deviceRequest), userId, app)
  }

  /**
   * **Truste** un appareil déjà enregistré (PENDING → TRUSTED) pour une app donnée
   * (étape OTP du login, comme aiglesend `verify-account`). N'a besoin que du
   * fingerprint + uid (l'appareil complet a été enregistré au PIN) → alimenté par
   * les **headers** device. Renvoie un identifiant MINIMAL (pas le modèle) ou `null`
   * si aucun lien PENDING (dégradation gracieuse). API PRODUIT.
   */
  async trustForApp(
    fingerprintHash: string,
    deviceUid: string,
    userId: string,
    app: string,
    geoLocation?: GeoIpLocation
  ): Promise<{ userDeviceId: string } | null> {
    const trusted = await this.trustDevice(userId, fingerprintHash, deviceUid, geoLocation, app)
    return trusted ? { userDeviceId: trusted.id } : null
  }

  /**
   * Met à jour le push token pour une liaison user↔device, **scopée par app**.
   *
   * `app` par défaut `AIGLESEND` (rétro-compat des appelants existants) ; le canal
   * business passe `AIGLEBUSINESS` pour cibler la liaison de confiance de cette app —
   * le token push est ainsi rattaché au bon appareil/app (cf. scoping notifications).
   */
  async updatePushToken(
    fingerprintHash: string,
    deviceUid: string,
    pushToken: string,
    userId: string,
    app: AppName = AppName.AIGLESEND
  ): Promise<UserDevice> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (!device || device.deviceUid !== deviceUid) {
      appLog.error(
        'DEVICE_NOT_FOUND_WITH_FINGERPRINT_HASH_AND_UID',
        { fingerprintHash, deviceUid, pushToken },
        'Device not found with fingerprint hash and UID: ' + fingerprintHash + ' / ' + deviceUid
      )
      throw new UnauthenticatedDeviceException()
    }

    const userDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
      userId,
      device.id,
      app
    )

    if (!userDevice) {
      throw new UnauthenticatedDeviceException()
    }

    try {
      userDevice.pushToken = pushToken
      userDevice.lastSeenAt = DateTime.now()

      return this.userDeviceRepository.save(userDevice)
    } catch (error) {
      appLog.error(
        'FAILED_TO_UPDATE_PUSH_TOKEN',
        { fingerprintHash, pushToken, userId, error },
        `Failed to update push token: ${error.message}`
      )
      throw new FailedToUpdatePushTokenException()
    }
  }

  /**
   * Valide qu'un appareil (fingerprint + uid des headers) existe, est **sûr** et **de
   * confiance** (TRUSTED) pour un couple (utilisateur, app). Porte de service PRODUIT :
   * ne renvoie aucun modèle core (invariant produit→core), lève une exception sinon.
   *  - appareil inconnu ou non lié à l'app → 401 `E_UNAUTHENTICATED_DEVICE` ;
   *  - appareil rooté/émulateur → 403 `E_UNSECURE_DEVICE` ;
   *  - incohérence de plateforme (si `platform` fourni) → 403 `E_PLATFORM_MISMATCH` ;
   *  - lien révoqué → 401 `E_DEVICE_REVOKED` ;
   *  - lien non trusté (PENDING) → 403 `NOT_TRUSTED_DEVICE`.
   */
  async assertTrustedForApp(
    userId: string,
    fingerprintHash: string,
    deviceUid: string,
    app: string,
    platform?: string | null
  ): Promise<void> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (!device || device.deviceUid !== deviceUid) {
      throw new UnauthenticatedDeviceException()
    }

    const userDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
      userId,
      device.id,
      app
    )

    if (!userDevice) {
      throw new UnauthenticatedDeviceException()
    }

    // Intégrité de l'appareil (matériel) : rooté / émulateur → refus.
    // ⚠️ DEV : en dehors de la production, on **n'applique pas** ce refus, sinon
    // aucun émulateur ne peut travailler. Le contrôle reste **actif en production**.
    if (adonisApp.inProduction && (device.isRooted || device.isEmulator)) {
      throw new Exception(
        'Opération impossible sur un appareil non sécurisé (rooté ou émulateur).',
        {
          status: 403,
          code: 'E_UNSECURE_DEVICE',
        }
      )
    }

    // Cohérence de plateforme (l'appareil déclaré doit correspondre à l'appareil enregistré).
    if (platform && device.platform && platform !== device.platform) {
      throw new Exception('Incohérence de plateforme détectée pour cet appareil.', {
        status: 403,
        code: 'E_PLATFORM_MISMATCH',
      })
    }

    if (userDevice.status === DeviceStatus.REVOKED) {
      throw new Exception('Cet appareil a été révoqué. Veuillez vous reconnecter.', {
        status: 401,
        code: 'E_DEVICE_REVOKED',
      })
    }

    if (userDevice.status !== DeviceStatus.TRUSTED) {
      throw new NotTrustedDeviceException()
    }
  }

  /**
   * Récupère un UserDevice pour validation (ex: middleware d'authentification).
   */
  async getUserDeviceForValidation(
    userId: string,
    fingerprintHash: string,
    deviceUid: string
  ): Promise<UserDevice | null> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (!device || device.deviceUid !== deviceUid) {
      return null
    }

    const userDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
      userId,
      device.id,
      AppName.AIGLESEND
    )

    if (userDevice) {
      // Attacher le device déjà chargé pour éviter une requête supplémentaire
      userDevice.$setRelated('device', device)
    }

    return userDevice
  }

  /**
   * Met à jour les traces d'utilisation d'un device (IP, geo, versions).
   * Mise à jour uniquement si l'IP a changé ou si la dernière vue date de plus d'une heure.
   */
  async updateDeviceTraces(
    userDevice: UserDevice,
    deviceInfo: DeviceHeadersInfo,
    geoIpLocation?: GeoIpLocation
  ): Promise<void> {
    const now = DateTime.now()

    const shouldUpdate =
      userDevice.ipLastSeen !== geoIpLocation?.ip ||
      !userDevice.lastSeenAt ||
      now.diff(userDevice.lastSeenAt, 'hours').hours >= 1

    if (shouldUpdate) {
      // Mise à jour de la liaison (IP, geo, lastSeen)
      userDevice.merge({
        ipLastSeen: geoIpLocation?.ip ?? userDevice.ipLastSeen,
        isVpn: geoIpLocation?.isVpn ?? userDevice.isVpn,
        lastCountryCode: geoIpLocation?.countryCode ?? userDevice.lastCountryCode,
        firstCountryCode: userDevice.firstCountryCode ?? geoIpLocation?.countryCode ?? undefined,
        lastSeenAt: now,
      })
      await this.userDeviceRepository.save(userDevice)

      // Mise à jour du device hardware (versions) si preloaded
      if (userDevice.device) {
        const device = userDevice.device
        const deviceChanged =
          device.appVersion !== deviceInfo.appVersion || device.osVersion !== deviceInfo.osVersion

        if (deviceChanged) {
          device.merge({
            appVersion: deviceInfo.appVersion ?? device.appVersion,
            osVersion: deviceInfo.osVersion ?? device.osVersion,
          })
          await this.deviceRepository.save(device)
        }
      }
    }
  }

  /**
   * Révoque une liaison user↔device.
   */
  async revokeDevice(userId: string, deviceId: string): Promise<UserDevice | null> {
    const userDevice = await this.userDeviceRepository.findActiveByUserAndDevice(
      userId,
      deviceId,
      AppName.AIGLESEND
    )

    if (!userDevice) {
      return null
    }

    userDevice.status = DeviceStatus.REVOKED
    userDevice.unlinkedAt = DateTime.now()

    return this.userDeviceRepository.save(userDevice)
  }

  /**
   * Récupère tous les comptes ayant utilisé un device (actifs + historiques).
   */
  async getAllUsersByDeviceId(deviceId: string): Promise<UserDevice[]> {
    return this.userDeviceRepository.findAllByDeviceId(deviceId)
  }

  private async ensureMaxDevicesNotReached(userId: string, app: string): Promise<void> {
    const maxReached = await this.checkIfMaxConnectionReached(userId, app)

    if (maxReached) {
      throw new MaxDevicesConnectedException()
    }
  }
}
