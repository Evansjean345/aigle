import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ServiceTypesUseCase from '../use_cases/service_types.use_case.js'

@inject()
export default class ServiceTypesController {
  constructor(private readonly useCase: ServiceTypesUseCase) {}

  async index({ request, response }: HttpContext) {
    const { page = 1, limit = 20, q } = request.qs()
    const result = await this.useCase.list({ page: Number(page), limit: Number(limit), q })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  async store({ request, response }: HttpContext) {
    const body = request.only(['code', 'label', 'description'])
    try {
      const created = await this.useCase.create(body)
      return response.created(created)
    } catch (error) {
      const message = (error as Error).message || 'Creation failed'
      const isBad = message.includes('required')
      return isBad
        ? response.badRequest({ message })
        : response.conflict({
            message: 'Unique constraint failed or invalid payload',
            error: String(error),
          })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const body = request.only(['code', 'label', 'description'])
    try {
      const item = await this.useCase.update(Number(params.id), body)
      return response.ok(item)
    } catch (error) {
      return response.conflict({
        message: 'Update failed. Possibly unique constraint violation',
        error: String(error),
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
