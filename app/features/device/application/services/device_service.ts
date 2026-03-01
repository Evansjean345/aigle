import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import Device from '#features/device/domain/models/device'
import { DeviceStatus } from '#features/device/domain/enums'
import { DeviceCommandDTO } from '#features/device/application/dto/device.command.tdo'
import NewDeviceDetected from '#features/device/application/events/new_device_detected'
import { maxDeviceConnectionAllowed } from '#config/app'
import appLog from '#shared/infrastructure/logging/app_log'
import FailedToGetDeviceByUserIdException from '#features/device/infrastructure/exceptions/failed_to_get_device_by_user_id_exception'
import FailedToSaveOrUpdateDeviceException from '#features/device/infrastructure/exceptions/failed_to_save_or_update_device_exception'
import UnauthenticatedDeviceException from '#features/device/infrastructure/exceptions/unauthenticated_device_exception'
import FailedToUpdatePushTokenException from '#features/device/infrastructure/exceptions/failed_to_update_push_token_exception'
import MaxDevicesConnectedException from '#features/device/infrastructure/exceptions/max_devices_connected_exception'

import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'

/**
 * @class DeviceService
 * Service interne pour la gestion des devices, utilisé par d'autres parties de l'application.
 */
@inject()
export default class DeviceService {
  /**
   * @constructor
   * @param deviceRepository
   */
  constructor(private readonly deviceRepository: DeviceRepository) {}

  /**
   * Fetches a list of devices associated with a specific user ID.
   *
   * @param {string} userId - The unique identifier of the user whose devices are to be retrieved.
   * @return {Promise<Device[]>} A promise that resolves to an array of devices associated with the specified user ID.
   * @throws {FailedToGetDeviceByUserIdException} Throws an exception if the operation fails, containing an error message, status code, and error code.
   */
  async getDeviceByUserId(userId: string): Promise<Device[]> {
    try {
      return await this.deviceRepository.getDevicesByUserId(userId)
    } catch (error) {
      appLog.error('FAILED_TO_GET_DEVICE_BY_USER_ID', { userId }, 'Failed to get device by user id')
      throw new FailedToGetDeviceByUserIdException()
    }
  }

  /**
   * Retrieves the list of trusted devices associated with a specific user.
   *
   * @param {string} userId - The unique identifier of the user whose trusted devices are to be retrieved.
   * @return {Promise<Device[]>} A promise that resolves to an array of trusted devices for the specified user.
   */
  async getTrustedDevices(userId: string): Promise<Device[]> {
    const devices = await this.getDeviceByUserId(userId)
    return devices.filter((d) => d.status === DeviceStatus.TRUSTED)
  }

  /**
   * Checks if the maximum allowed number of device connections for a user has been reached.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<boolean>} A promise that resolves to `true` if the maximum number of device connections is reached, otherwise `false`.
   */
  async checkIfMaxConnectionReached(userId: string): Promise<boolean> {
    const count = await this.deviceRepository.countDevicesByStatus(userId, [
      DeviceStatus.TRUSTED,
      DeviceStatus.PENDING,
    ])
    return count >= maxDeviceConnectionAllowed
  }

  /**
   * Checks if a device with the given fingerprint hash is trusted.
   *
   * @return {Promise<boolean>} A promise that resolves to `true` if the device is trusted; otherwise, `false`.
   * @param fingerprintHash - The fingerprint hash of the device to be checked.
   * @param deviceUid - The unique identifier of the device to be checked.
   */
  async isDeviceTrusted(fingerprintHash: string, deviceUid: string): Promise<boolean> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)
    return device?.status === DeviceStatus.TRUSTED && device?.deviceUid === deviceUid
  }

  /**
   * Récupère un device par son ID.
   * @param deviceId
   */
  async findById(deviceId: string): Promise<Device | null> {
    return this.deviceRepository.findById(deviceId)
  }

  /**
   * Marque un device spécifique comme de confiance en utilisant son fingerprint hash.
   * Met également à jour l'IP et la date de dernière connexion.
   * Utilisé après validation OTP réussie.
   * @param userId - L'ID de l'utilisateur propriétaire du device
   * @param fingerprintHash - Le hash du fingerprint du device
   * @param deviceUid
   * @param clientIp - L'adresse IP du client (optionnel)
   */
  async trustDeviceByFingerprintAndUid(
    userId: string,
    fingerprintHash: string,
    deviceUid: string,
    clientIp?: string
  ): Promise<Device | null> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (device && device.deviceUid === deviceUid) {
      if (device.userId !== userId) {
        appLog.warn(
          'DEVICE_USER_MISMATCH_ON_TRUST',
          { fingerprintHash, deviceUserId: device.userId, currentUserId: userId },
          'Device belongs to another user. Reassigning device during trust process.'
        )
        device.userId = userId
      }

      device.status = DeviceStatus.TRUSTED
      device.lastSeenAt = DateTime.now()

      if (clientIp) {
        device.ipLastSeen = clientIp
      }

      return this.deviceRepository.save(device)
    }

    return null
  }

  /**
   * Saves or updates a device record based on the provided payload and user ID.
   * If a device with the same fingerprint hash exists, the device record is updated.
   * Otherwise, a new device record is created and saved.
   *
   * @param {DeviceCommandDTO} payload - The data transfer object containing device information.
   * @param {string} userId - The unique identifier of the user associated with the device.
   * @return {Promise<Device>} A promise that resolves to the saved or updated device object.
   * @throws {FailedToSaveOrUpdateDeviceException} Throws an error if the operation fails.
   */
  async saveDevice(payload: DeviceCommandDTO, userId: string): Promise<Device> {
    try {
      // Vérifier d'abord si le device est deja enregistré
      const existingDevice = await this.deviceRepository.findByFingerprintHash(
        payload.fingerprintHash
      )

      const isNewDevice = !existingDevice
      const deviceBelongsToUser = existingDevice?.userId === userId

      // verifier le quota de l'utilisateur si c'est un nouveau device
      if (isNewDevice || !deviceBelongsToUser) {
        await this.ensureMaxDevicesNotReached(userId)
      }

      // Déterminer si la device est primaire ou non
      const userDeviceCount = await this.deviceRepository.countByUserId(userId)
      let shouldBePrimary = false

      if (isNewDevice) {
        shouldBePrimary = userDeviceCount === 0
      } else if (deviceBelongsToUser) {
        shouldBePrimary = userDeviceCount === 1
      }

      // Construire le payload pour updateOrCreate
      const deviceData: Partial<Device> = {
        userId: userId,
        deviceUid: payload.deviceUid,
        platform: payload.platform,
        brand: payload.brand,
        model: payload.model,
        osVersion: payload.osVersion,
        appVersion: payload.appVersion,
        isEmulator: payload.isEmulator,
        isRooted: payload.isRooted,
        ipLastSeen: payload.ipLastSeen,
        lastSeenAt: DateTime.now(),
        isPrimary: shouldBePrimary,
      }

      // Ajouter les champs spécifiques à la création
      if (isNewDevice) {
        deviceData.fingerprintHash = payload.fingerprintHash
        deviceData.ipFirstSeen = payload.ipFirstSeen
        deviceData.status = DeviceStatus.PENDING
      }

      // Opération atomique : updateOrCreate
      const device = await this.deviceRepository.updateOrCreateByFingerprintHash(
        payload.fingerprintHash,
        deviceData
      )

      // Notification si nouveau device OU device existant d'un autre utilisateur
      if (isNewDevice || !deviceBelongsToUser) {
        await NewDeviceDetected.dispatch(userId, device)
      }

      return device
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
   * Met à jour le push token d'un device en utilisant le fingerprint hash.
   * Utilisé quand l'utilisateur accepte de recevoir les notifications.
   * @param fingerprintHash - Le fingerprint hash du device (depuis le header)
   * @param deviceUid
   * @param pushToken - Le push token à enregistrer
   * @param userId - L'identifiant de l'utilisateur associé au device
   * @returns Le device mis à jour ou null si non trouvé
   */
  async updatePushTokenByFingerprintAndUid(
    fingerprintHash: string,
    deviceUid: string,
    pushToken: string,
    userId: string
  ): Promise<Device> {
    const device = await this.deviceRepository.findByFingerprintHash(fingerprintHash)

    if (!device || device.deviceUid !== deviceUid) {
      appLog.error(
        'DEVICE_NOT_FOUND_WITH_FINGERPRINT_HASH_AND_UID',
        { fingerprintHash: fingerprintHash, deviceUid: deviceUid, pushToken: pushToken },
        'Device not found with fingerprint hash and UID: ' + fingerprintHash + ' / ' + deviceUid
      )

      throw new UnauthenticatedDeviceException()
    }

    if (device.userId !== userId) {
      appLog.warn(
        'DEVICE_USER_MISMATCH_ON_PUSH_TOKEN_UPDATE',
        { fingerprintHash, pushToken, deviceUserId: device.userId, currentUserId: userId },
        'Device belongs to another user. Reassigning device to current user.'
      )
      device.userId = userId
    }

    try {
      device.pushToken = pushToken
      device.lastSeenAt = DateTime.now()

      return this.deviceRepository.save(device)
    } catch (error) {
      appLog.error(
        'FAILED_TO_UPDATE_PUSH_TOKEN',
        { fingerprintHash: fingerprintHash, pushToken: pushToken, userId: userId, error: error },
        `Failed to update push token: ${error.message}`
      )

      throw new FailedToUpdatePushTokenException()
    }
  }

  /**
   * Ensures that the maximum number of allowed devices for a user has not been reached.
   * If the limit is exceeded, an exception is thrown.
   *
   * @param {string} userId - The unique identifier of the user whose device connections are being validated.
   * @return {Promise<void>} A promise that resolves if the maximum device limit has not been exceeded,
   *                         or rejects with an exception if the limit is reached.
   */
  private async ensureMaxDevicesNotReached(userId: string): Promise<void> {
    const maxReached = await this.checkIfMaxConnectionReached(userId)

    if (maxReached) {
      throw new MaxDevicesConnectedException()
    }
  }

  /**
   * Retrieves a device associated with the given user ID, fingerprint hash, and device UID for validation purposes.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} fingerprintHash - The hash representing the device fingerprint.
   * @param {string} deviceUid - The unique identifier of the device.
   * @return {Promise<Device | null>} A promise that resolves to the device if found, or null if no matching device exists.
   */
  async getDeviceForValidation(
    userId: string,
    fingerprintHash: string,
    deviceUid: string
  ): Promise<Device | null> {
    return this.deviceRepository.findByUserAndDeviceIdentifiers(userId, fingerprintHash, deviceUid)
  }

  /**
   * Updates the device traces by checking if the device's IP address has changed
   * or if the last observed activity was more than an hour ago. If an update
   * is required, the method updates the device information and persists it to the database.
   *
   * @param {Device} device - The device entity that needs to be updated.
   * @param {DeviceHeadersInfo} deviceInfo - The information headers containing updates
   *                                          related to the device's IP, app version, and OS version.
   * @return {Promise<void>} A promise that resolves when the device information has been successfully updated and saved.
   */
  async updateDeviceTraces(device: Device, deviceInfo: DeviceHeadersInfo): Promise<void> {
    const now = DateTime.now()

    // On ne met à jour que si l'IP a changé ou si la dernière vue date de plus d'une heure
    const shouldUpdate =
      device.ipLastSeen !== deviceInfo.ipAddress ||
      !device.lastSeenAt ||
      now.diff(device.lastSeenAt, 'hours').hours >= 1

    if (shouldUpdate) {
      device.merge({
        ipLastSeen: deviceInfo.ipAddress ?? device.ipLastSeen,
        lastSeenAt: now,
        appVersion: deviceInfo.appVersion ?? device.appVersion,
        osVersion: deviceInfo.osVersion ?? device.osVersion,
      })
      await this.deviceRepository.save(device)
    }
  }
}
