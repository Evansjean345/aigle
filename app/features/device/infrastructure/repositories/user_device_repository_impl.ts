import type UserDeviceRepository from '#features/device/domain/interfaces/user_device_repository'
import UserDevice from '#features/device/domain/models/user_device'

export default class UserDeviceRepositoryImpl implements UserDeviceRepository {
  async findById(id: string): Promise<UserDevice | null> {
    return UserDevice.query().where('id', id).preload('device').first()
  }

  async save(userDevice: UserDevice): Promise<UserDevice> {
    return await userDevice.save()
  }

  async findActiveByUserAndDevice(userId: string, deviceId: string): Promise<UserDevice | null> {
    return UserDevice.query()
      .where('userId', userId)
      .where('deviceId', deviceId)
      .whereNull('unlinkedAt')
      .first()
  }

  async findActiveByUserId(userId: string): Promise<UserDevice[]> {
    return UserDevice.query().where('userId', userId).whereNull('unlinkedAt').preload('device')
  }

  async findAllByDeviceId(deviceId: string): Promise<UserDevice[]> {
    return UserDevice.query().where('deviceId', deviceId).orderBy('linkedAt', 'asc')
  }

  async findActiveByDeviceId(deviceId: string): Promise<UserDevice[]> {
    return UserDevice.query().where('deviceId', deviceId).whereNull('unlinkedAt')
  }

  async countActiveByUserAndStatuses(userId: string, statuses: string[]): Promise<number> {
    const result = await UserDevice.query()
      .where('userId', userId)
      .whereNull('unlinkedAt')
      .whereIn('status', statuses)
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const result = await UserDevice.query()
      .where('userId', userId)
      .whereNull('unlinkedAt')
      .count('* as total')

    return Number(result[0].$extras.total)
  }

  async findByUserAndDevice(userId: string, deviceId: string): Promise<UserDevice | null> {
    return UserDevice.query().where('userId', userId).where('deviceId', deviceId).first()
  }

  /**
   * Retrieve all user-device associations for a device, optionally filtering by active status.
   *
   * @param {string} deviceId - The device ID to filter by.
   * @param {boolean} [activeOnly=false] - Whether to filter only active associations.
   * @returns {Promise<UserDevice[]>} - Array of user-device associations.
   */
  async findAllByDeviceIdWithUser(
    deviceId: string,
    activeOnly: boolean = false
  ): Promise<UserDevice[]> {
    const query = UserDevice.query()
      .where('deviceId', deviceId)
      .preload('user')
      .orderBy('linkedAt', 'desc')

    if (activeOnly) {
      query.whereNull('unlinkedAt')
    }

    return query
  }
}
