import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import IdentityVerifyService from '#services/identity_verify_service'
import { createIdentityValidator } from '#validators/verify_identity'

@inject()
export default class VerifyIdentitiesController {
  constructor(protected identityVerifyService: IdentityVerifyService) {}
  async create_or_update({ response, request, auth }: HttpContext) {
    // await createIdentityValidator.validate(request.all())
    const result = await this.identityVerifyService.create_or_update(request, auth)

    return "hello"
    // return response.status(result.code).send(result)
  }
}
