import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Device from '#core/identity/device/domain/models/device'

export default abstract class DeviceRepository {
  /**
   * Saves a device entity to the database, optionally within a transaction context.
   *
   * @param {Device} device - The device entity to save.
   * @param trx - Optional transaction context.
   */
  abstract save(device: Device, trx?: TransactionClientContract): Promise<Device>

  /**
   * Find all devices with pagination, filters, and enriched counters.
   */
  abstract findAllPaginated(filters: {
    minAccounts?: number
    isEmulator?: boolean
    isRooted?: boolean
    hasVpn?: boolean
    platform?: string
    search?: string
    sortBy: string
    order: string
    page: number
    perPage: number
  }): Promise<{
    data: Device[]
    meta: { total: number; page: number; perPage: number; lastPage: number }
  }>

  /**
   * Find a device by its ID.
   * @param {string} deviceId - The ID of the device to find.
   */
  abstract findById(deviceId: string): Promise<Device | null>

  /**
   * Find a device by its fingerprint hash.
   * @param {string} fingerprintHash - The fingerprint hash of the device to find.
   */
  abstract findByFingerprintHash(fingerprintHash: string): Promise<Device | null>

  /**
   * Find a device by its device UID.
   * @param {string} deviceUid - The device UID of the device to find.
   */
  abstract findByDeviceUid(deviceUid: string): Promise<Device | null>

  /**
   * Delete a device.
   */
  abstract deleteDevice(device: Device): Promise<void>

  /**
   * Atomically finds a device by fingerprint hash and updates it, or creates a new one.
   * Relies on the UNIQUE constraint on fingerprint_hash to prevent race conditions.
   */
  abstract updateOrCreateByFingerprintHash(
    fingerprintHash: string,
    payload: Partial<Device>
  ): Promise<Device>
}
