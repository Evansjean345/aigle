import Device from '#shared/models/device'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default abstract class DeviceRepository {
  /**
   * Saves a device entity to the database, optionally within a transaction context.
   * @param device
   * @param trx
   */
  abstract save(device: Device, trx?: TransactionClientContract): Promise<Device>

  /**
   * Find a device by its token.
   * @param token
   */
  abstract findByToken(token: string): Promise<Device | null>

  abstract findByUserId(userId: string): Promise<Device | null>

  abstract getDevicesByUserId(userId: string): Promise<Device[]>
}
