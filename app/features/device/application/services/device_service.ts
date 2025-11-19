import DeviceRepository from '../../domain/interfaces/device_repository.js'
import Device from '../../domain/models/device.js'
import { Exception } from '@adonisjs/core/exceptions'
import { inject } from '@adonisjs/core'
import { DeviceCommandDTO } from '../dto/device.command.tdo.js'

/**
 * @class DeviceService
 */
@inject()
export default class DeviceService {
  /**
   * @constructor
   * @param deviceRepository
   */
  constructor(private readonly deviceRepository: DeviceRepository) {}

  async getDeviceByUserId(userId: string): Promise<Device[]> {
    try {
      return await this.deviceRepository.getDevicesByUserId(userId)
    } catch (error) {
      throw new Exception('Failed to get device by user id', {
        status: 500,
        code: 'FAILED_TO_GET_DEVICE_BY_USER_ID',
      })
    }
  }

  /**
   * Save or update a device entity based on the provided payload and user ID.
   * @param payload
   * @param userId
   */
  async saveDevice(payload: DeviceCommandDTO, userId: string): Promise<Device> {
    try {
      const existingDevice = await this.deviceRepository.findByToken(payload.token)

      if (existingDevice) {
        existingDevice.userId = userId
        existingDevice.appVersion = payload.appVersion
        existingDevice.platform = payload.platform
        existingDevice.platformVersion = payload.platformVersion
        existingDevice.iosAppVersion = payload.iosVersion
        existingDevice.androidAppVersion = payload.androidVersion

        return this.deviceRepository.save(existingDevice)
      }

      const newDevice = new Device()
      newDevice.userId = userId
      newDevice.token = payload.token
      newDevice.appVersion = payload.appVersion
      newDevice.platform = payload.platform
      newDevice.platformVersion = payload.platformVersion
      newDevice.iosAppVersion = payload.iosVersion
      newDevice.androidAppVersion = payload.androidVersion

      await this.deviceRepository.save(newDevice)

      return newDevice
    } catch (error) {
      console.log(error)

      throw new Exception('Failed to save or update device', {
        status: 500,
        code: 'FAILED_TO_SAVE_OR_UPDATE_DEVICE',
      })
    }
  }
}
