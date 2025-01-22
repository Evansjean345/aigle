import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AuthServices from '../../services/auth_services.js'
import { registerValidator,loginValidator, checkpinValidator } from '#validators/auth'

@inject()
export default class AuthController {
  constructor(private authServices: AuthServices) {} // Changer le nom ici pour éviter la confusion

  async register({ response, request }: HttpContext) {
    const payload = await registerValidator.validate(request.all())
    const user = await this.authServices.registerUser(request.body())
    return response.status(user.code).send(user)
  }

  async login({ response, request }: HttpContext) {
    const payload = await loginValidator.validate(request.all())
    const user = await this.authServices.loginUser(request.body())
    return response.status(user.code).send(user)
  }

  async user_auth({ response, requesta,auth }: HttpContext) {
    const user = await this.authServices.user_auth(auth)
    return response.status(user.code).send(user)
  }

  async logout({ response, auth }: HttpContext) {
    const res = await this.authServices.logoutUser(auth)
    return response.status(res.code).send(res)
  }

  async check_pin_code({ response, request }: HttpContext) {
    const payload = await checkpinValidator.validate(request.all())
    const user = await this.authServices.check_pin_code(request.body())
    return response.status(user.code).send(user)
  }

  async access_token({ response, request }: HttpContext) {
    const user = await this.authServices.access_token(request.body())
    return response.status(user.code).send(user)
  }

  async check_phone({ response, request }: HttpContext) {
    const user = await this.authServices.check_phone(request.body())
    return response.status(user.code).send(user)
  }

  async reset_password({ response, request }: HttpContext) {
    const user = await this.authServices.reset_password(request.body())
    return response.status(user.code).send(user)
  }
}
