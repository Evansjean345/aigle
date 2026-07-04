import type UserDevice from '#core/device/domain/models/user_device'

export default abstract class UserDeviceRepository {
  /**
   * Find a user-device association by its ID.
   */
  abstract findById(id: string): Promise<UserDevice | null>

  /**
   * Save a user-device association.
   */
  abstract save(userDevice: UserDevice): Promise<UserDevice>

  /**
   * Find an active association between a user and a device.
   * Active means unlinkedAt is null.
   */
  abstract findActiveByUserAndDevice(userId: string, deviceId: string): Promise<UserDevice | null>

  /**
   * Find all active associations for a user (with preloaded device).
   */
  abstract findActiveByUserId(userId: string): Promise<UserDevice[]>

  /**
   * Find all associations (active + historical) for a device.
   */
  abstract findAllByDeviceId(deviceId: string): Promise<UserDevice[]>

  /**
   * Find all active associations for a device.
   */
  abstract findActiveByDeviceId(deviceId: string): Promise<UserDevice[]>

  /**
   * Count active associations for a user with specific statuses.
   */
  abstract countActiveByUserAndStatuses(userId: string, statuses: string[]): Promise<number>

  /**
   * Count total active associations for a user.
   */
  abstract countActiveByUserId(userId: string): Promise<number>

  /**
   * Check if a user has ever used a device (active or historical).
   */
  abstract findByUserAndDevice(userId: string, deviceId: string): Promise<UserDevice | null>

  /**
   * Find all associations for a device with preloaded user.
   * Ordered by linkedAt desc (most recent first).
   */
  abstract findAllByDeviceIdWithUser(deviceId: string, activeOnly?: boolean): Promise<UserDevice[]>
}
