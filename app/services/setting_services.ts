import { inject } from '@adonisjs/core'
import { SettingInterface } from '../contracts/setting_interface.js'
import { SettingRepository } from '#repositories/setting_repository'
import { calculateFee } from '../helpers/fee_helpers.js'

@inject()
export default class SettingsServices {
  constructor(private settingRepository: SettingRepository) {}
  async operator() {
    return await this.settingRepository.get_operator()
  }

  async get_service() {
    return await this.settingRepository.get_service()
  }

  async create_service(data) {
    return await this.settingRepository.create_service(data)
  }

  async create_operator(data) {
    return await this.settingRepository.create_service(data)
  }

  async update_operator(data) {
    return await this.settingRepository.update_operator(data)
  }

  async calculate_fee(data: any) {
    let result = await calculateFee(data.amount, data?.operation_type, 'subtract')
    return result
  }
}
