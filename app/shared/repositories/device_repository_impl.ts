import DeviceRepository from '#shared/interfaces/repositories/device_repository'
import Device from '#shared/models/device'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class DeviceRepositoryImpl implements DeviceRepository {
  findByUserId(userId: string): Promise<Device | null> {
    return Device.findBy('userId', userId)
  }

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
   * Find a device entity by its token.
   * @param token
   * @returns Promise<Device | null>
   */
  async findByToken(token: string): Promise<Device | null> {
    return Device.findBy('token', token)
  }
}
