import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OtpService from '#services/otp_service'

@inject()
export default class OtpsController {
  constructor(private otpServices: OtpService) {} // Changer le nom ici pour éviter la confusion

  async send_otp({ response, request }: HttpContext) {
    const { phone, userId } = request.params()
    const res = await this.otpServices.sendOtp(phone, userId)
    return response.status(res.code).send(res)
  }

  async check_otp({ response, request }: HttpContext) {
    const user = await this.otpServices.verifyOtp(request.body())
    return response.status(user.code).send(user)
  }
}
