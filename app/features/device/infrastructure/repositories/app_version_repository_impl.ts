import AppVersionRepository from '#features/device/domain/interfaces/app_version_repository'
import AppVersion from '#features/device/domain/models/app_version'

export default class AppVersionRepositoryImpl implements AppVersionRepository {
  /**
   * Finds the latest application version for the specified device type.
   *
   * @param {'ios' | 'android'} deviceType - The type of device for which to find the latest application version.
   * @return {Promise<AppVersion | null>} A promise that resolves to the latest application version for the specified device type, or null if no version is found.
   */
  async findLatestByDeviceType(deviceType: 'ios' | 'android'): Promise<AppVersion | null> {
    return AppVersion.query()
      .where('device_type', deviceType)
      .orderBy('release_date', 'desc')
      .first()
  }

  /**
   * Retrieves a paginated list of all app versions, ordered by their release date in descending order.
   *
   * @param {number} page - The page number to retrieve. Defaults to 1.
   * @param {number} perPage - The number of items to include per page. Defaults to 10.
   * @return {Promise<AppVersion[]>} A promise that resolves to an array of AppVersion objects.
   */
  async findAll(page = 1, perPage = 10): Promise<AppVersion[]> {
    return AppVersion.query().orderBy('createdAt', 'desc').paginate(page, perPage)
  }

  /**
   * Retrieves an app version by its unique identifier.
   *
   * @param {number} id - The unique identifier of the app version to retrieve.
   * @return {Promise<AppVersion | null>} A promise that resolves to the app version with the specified ID, or null if not found.
   */
  async findById(id: number): Promise<AppVersion | null> {
    return AppVersion.find(id)
  }

  /**
   * Persists the given AppVersion instance to the database.
   *
   * @param {AppVersion} appVersion - The AppVersion instance to be saved.
   * @return {Promise<AppVersion>} A promise that resolves to the saved AppVersion instance.
   */
  async save(appVersion: AppVersion): Promise<AppVersion> {
    await appVersion.save()
    return appVersion
  }

  /**
   * Deletes the specified app version.
   *
   * @param {AppVersion} appVersion - The app version instance to be deleted.
   * @return {Promise<void>} A promise that resolves when the app version is successfully deleted.
   */
  async delete(appVersion: AppVersion): Promise<void> {
    await appVersion.delete()
  }
}
