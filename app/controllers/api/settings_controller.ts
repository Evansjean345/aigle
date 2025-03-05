import SettingsServices from '#services/setting_services'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class SettingsController {
  constructor(private settingServices: SettingsServices) {}
  async operator({ response, request, auth }: HttpContext) {
    const operation = await this.settingServices.operator()
    return response.status(200).send(operation)
  }

  async service({ response, request, auth }: HttpContext) {
    const operation = await this.settingServices.get_service()
    return response.status(200).send(operation)
  }
  async create_service({ response, request, auth }: HttpContext) {
    const operation = await this.settingServices.create_service(request.all(),auth)
    return response.send(operation)
  }

  async create_operator({ response, request, auth }: HttpContext) {
    const operation = await this.settingServices.create_operator(request.all(),auth)
    return response.send(operation)
  }

  async calculate_fee({ response, request, auth }: HttpContext) {
    const operation = await this.settingServices.calculate_fee(request.all(), auth)
    return response.send(operation)
  }
}
