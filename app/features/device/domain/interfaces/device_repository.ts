import Device from '../models/device.js'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default abstract class DeviceRepository {
  /**
   * Saves a device entity to the database, optionally within a transaction context.
   * @param device
   * @param trx
   */
  abstract save(device: Device, trx?: TransactionClientContract): Promise<Device>

  /**
   * Find a device by its ID.
   * @param deviceId
   */
  abstract findById(deviceId: string): Promise<Device | null>

  /**
   * Find a device by its fingerprint hash.
   * @param fingerprintHash
   */
  abstract findByFingerprintHash(fingerprintHash: string): Promise<Device | null>

  /**
   * Find a device by its device UID.
   * @param deviceUid
   */
  abstract findByDeviceUid(deviceUid: string): Promise<Device | null>

  /**
   * Find a device by user ID.
   * @param userId
   */
  abstract findByUserId(userId: string): Promise<Device | null>

  /**
   * Get all devices for a user.
   * @param userId
   */
  abstract getDevicesByUserId(userId: string): Promise<Device[]>

  /**
   * Count devices for a user with specific statuses.
   * @param userId
   * @param statuses
   */
  abstract countDevicesByStatus(userId: string, statuses: string[]): Promise<number>

  /**
   * Find a device by user ID, fingerprint hash, and device UID.
   * @param userId
   * @param fingerprintHash
   * @param deviceUid
   */
  abstract findByUserAndDeviceIdentifiers(
    userId: string,
    fingerprintHash: string,
    deviceUid: string
  ): Promise<Device | null>

  /**
   * Count total devices for a user.
   * @param userId
   */
  abstract countByUserId(userId: string): Promise<number>

  /**
   * Delete a device.
   * @param device
   */
  abstract deleteDevice(device: Device): Promise<void>

  /**
   * Atomically finds a device by fingerprint hash and updates it, or creates a new one.
   * Relies on the UNIQUE constraint on fingerprint_hash to prevent race conditions.
   * @param fingerprintHash - The search key
   * @param payload - The data to update or create with
   */
  abstract updateOrCreateByFingerprintHash(
    fingerprintHash: string,
    payload: Partial<Device>
  ): Promise<Device>
}
