import Service from '#models/service'
import TypePayment from '#models/type_payment'
import { SettingInterface } from '../contracts/setting_interface.js'

export class SettingRepository implements SettingInterface {
  async get_operator() {
    let response = await TypePayment.query().preload('operator')
    return response
  }

  async get_service() {
    let response = await Service.all()
    return response
  }

  async create_service(data) {
    let response = await Service.create(data)
    return response
  }

  async create_operator(data) {
    let response = await TypePayment.create(data)
    return response
  }

  async update_operator(data) {
    let response = await TypePayment.create(data)
    return response
  }
}
