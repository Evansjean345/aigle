import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import Device from '#features/device/domain/models/device'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * DeviceRepositoryImpl is an implementation of the DeviceRepository interface.
 * It provides methods to interact with the database for operations related to device entities.
 */
export default class DeviceRepositoryImpl implements DeviceRepository {
  /**
   * Finds a device by its ID.
   *
   * @param {string} deviceId - The unique identifier of the device to be retrieved.
   * @return {Promise<Device | null>} A promise that resolves to the device, or null if not found.
   */
  findById(deviceId: string): Promise<Device | null> {
    return Device.find(deviceId)
  }

  /**
   * Finds a device associated with the specified userId.
   *
   * @param {string} userId - The unique identifier of the user whose device is to be retrieved.
   * @return {Promise<Device | null>} A promise that resolves to the device associated with the given userId, or null if no device is found.
   */
  findByUserId(userId: string): Promise<Device | null> {
    return Device.findBy('userId', userId)
  }

  /**
   * Retrieves a list of devices associated with a specific user based on their user ID.
   *
   * @param {string} userId - The unique identifier of the user whose devices need to be fetched.
   * @return {Promise<Device[]>} A promise that resolves to an array of Device objects associated with the given user ID.
   */
  getDevicesByUserId(userId: string): Promise<Device[]> {
    return Device.query().where('userId', userId)
  }

  /**
   * Save a device entity to the database, optionally within a transaction context.
   * @param device
   * @param trx
   */
  async save(device: Device, trx?: TransactionClientContract) {
    if (trx) {
      return await device.useTransaction(trx).save()
    }

    return await device.save()
  }

  /**
   * Finds a device by the provided fingerprint hash.
   *
   * @param {string} fingerprintHash - The fingerprint hash associated with the device to be retrieved.
   * @return {Promise<Device | null>} A promise that resolves to the device if found, or null if no device is associated with the given fingerprint hash.
   */
  async findByFingerprintHash(fingerprintHash: string): Promise<Device | null> {
    return Device.findBy('fingerprintHash', fingerprintHash)
  }

  /**
   * Finds a device by the provided device UID.
   *
   * @param {string} deviceUid - The device UID associated with the device to be retrieved.
   * @return {Promise<Device | null>} A promise that resolves to the device if found, or null if no device is associated with the given device UID.
   */
  async findByDeviceUid(deviceUid: string): Promise<Device | null> {
    return Device.findBy('deviceUid', deviceUid)
  }

  /**
   * Counts the number of devices associated with a specific user and having specific statuses.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string[]} statuses - An array of statuses to filter by.
   * @return {Promise<number>} A promise that resolves to the count of devices.
   */
  async countDevicesByStatus(userId: string, statuses: string[]): Promise<number> {
    const result = await Device.query()
      .where('userId', userId)
      .whereIn('status', statuses)
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  /**
   * Finds a device by user ID, fingerprint hash, and device UID.
   *
   * @param {string} userId
   * @param {string} fingerprintHash
   * @param {string} deviceUid
   * @return {Promise<Device | null>}
   */
  async findByUserAndDeviceIdentifiers(
    userId: string,
    fingerprintHash: string,
    deviceUid: string
  ): Promise<Device | null> {
    return Device.query()
      .where('userId', userId)
      .where('fingerprintHash', fingerprintHash)
      .where('deviceUid', deviceUid)
      .first()
  }

  /**
   * Counts the total number of devices associated with a specific user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<number>} A promise that resolves to the count of devices.
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await Device.query().where('userId', userId).count('* as total')
    return Number(result[0].$extras.total)
  }

  /**
   * Deletes a device entity from the database.
   *
   * @param {Device} device - The device entity to be deleted.
   * @return {Promise<void>} A promise that resolves when the device has been successfully deleted.
   */
  async deleteDevice(device: Device): Promise<void> {
    await device.delete()
  }
}
