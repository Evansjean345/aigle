import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import MobileAuthService from '../services/mobile_auth_service.js'
import { registerValidator, loginValidator, checkpinValidator } from '#validators/auth'

@inject()
export default class AuthController {
  constructor(private mobileAuthService: MobileAuthService) {}

  async register({ response, request }: HttpContext) {
    const payload = await registerValidator.validate(request.all())
    const user = await this.mobileAuthService.registerUser(request.body())
    return response.status(user.code).send(user)
  }

  async login({ response, request }: HttpContext) {
    const payload = await loginValidator.validate(request.all())
    const user = await this.mobileAuthService.loginUser(request.body())
    return response.status(user.code).send(user)
  }

  async userAuth({ response, auth }: HttpContext) {
    const user = await this.mobileAuthService.userAuth(auth)
    return response.status(user.code).send(user)
  }

  async logout({ response, auth }: HttpContext) {
    const res = await this.mobileAuthService.logoutUser(auth)
    return response.status(res.code).send(res)
  }

  async checkPinCode({ response, request }: HttpContext) {
    const payload = await checkpinValidator.validate(request.all())
    const user = await this.mobileAuthService.checkPinCode(request.body())
    return response.status(user.code).send(user)
  }

  async accessToken({ response, request }: HttpContext) {
    const user = await this.mobileAuthService.accessToken(request.body())
    return response.status(user.code).send(user)
  }

  async checkPhone({ response, request }: HttpContext) {
    const user = await this.mobileAuthService.checkPhone(request.body())
    return response.status(user.code).send(user)
  }

  async resetPassword({ response, request }: HttpContext) {
    const user = await this.mobileAuthService.resetPassword(request.body())
    return response.status(user.code).send(user)
  }

  async sendOtp({ response, request }: HttpContext) {
    const result = await this.mobileAuthService.sendOtp(request.body())
    return response.status(result.code).send(result)
  }
}
