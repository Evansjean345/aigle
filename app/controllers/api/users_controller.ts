import type { HttpContext } from '@adonisjs/core/http'
import UserService from '#services/user_service'
import { inject } from '@adonisjs/core'

@inject()
export default class UsersController {
  constructor(protected userService: UserService) {}
  async analytic({ response, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const data = await this.userService.analytic(auth)
    console.log('logged in analytic')
    return response.status(data.code).send(data)
  }

  async all_user({ response, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const data = await this.userService.all_user(auth)
    return response.status(data.code).send(data)
  }
}
