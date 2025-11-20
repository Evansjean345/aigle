import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import Device from '#features/device/domain/models/device'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * DeviceRepositoryImpl is an implementation of the DeviceRepository interface.
 * It provides methods to interact with the database for operations related to device entities.
 */
export default class DeviceRepositoryImpl implements DeviceRepository {
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
   * Finds a device by the provided token.
   *
   * @param {string} token - The token associated with the device to be retrieved.
   * @return {Promise<Device | null>} A promise that resolves to the device if found, or null if no device is associated with the given token.
   */
  async findByToken(token: string): Promise<Device | null> {
    return Device.findBy('token', token)
  }
}
