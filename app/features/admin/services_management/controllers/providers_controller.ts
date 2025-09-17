import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ProvidersUseCase from '../use_cases/providers.use_case.js'
import { ProviderType } from '#shared/models/provider'

@inject()
export default class ProvidersController {
  constructor(private readonly useCase: ProvidersUseCase) {}

  async index({ request, response }: HttpContext) {
    const { page = 1, limit = 20, q, type } = request.qs()
    const result = await this.useCase.list({
      page: Number(page),
      limit: Number(limit),
      q,
      type: type as ProviderType,
    })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  async store({ request, response }: HttpContext) {
    const body = request.only(['code', 'name', 'type'])

    try {
      const created = await this.useCase.create(body)
      return response.created(created)
    } catch (error) {
      const message = (error as Error).message || 'Creation failed'
      const isBad = message.includes('required') || message.includes('must be one of')
      return isBad
        ? response.badRequest({ message })
        : response.conflict({
            message: 'Unique constraint failed or invalid payload',
            error: String(error),
          })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const body = request.only(['code', 'name', 'type'])
    try {
      const item = await this.useCase.update(Number(params.id), body)
      return response.ok(item)
    } catch (error) {
      const message = (error as Error).message || 'Update failed'
      const isBad = message.includes('must be one of')
      return isBad
        ? response.badRequest({ message })
        : response.conflict({
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
