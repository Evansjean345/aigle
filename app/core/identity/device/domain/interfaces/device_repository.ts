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

  /** Crée une installation. */
  abstract create(payload: Partial<Device>): Promise<Device>

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
   * Retrouve une installation par sa paire (empreinte, uid).
   *
   * C'est la paire qui identifie une ligne : l'empreinte peut être partagée par plusieurs
   * installations, l'uid non.
   */
  abstract findByFingerprintAndUid(
    fingerprintHash: string,
    deviceUid: string
  ): Promise<Device | null>

  /**
   * Toutes les installations partageant une empreinte.
   *
   * Plus d'une signifie soit une réinstallation, soit une collision d'empreinte entre deux appareils
   * distincts — l'appelant tranche.
   */
  abstract findAllByFingerprintHash(fingerprintHash: string): Promise<Device[]>

  /**
   * Find a device by its device UID.
   * @param {string} deviceUid - The device UID of the device to find.
   */
  abstract findByDeviceUid(deviceUid: string): Promise<Device | null>

  /**
   * Delete a device.
   */
  abstract deleteDevice(device: Device): Promise<void>
}
