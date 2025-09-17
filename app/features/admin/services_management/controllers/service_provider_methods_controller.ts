import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ServiceProviderMethodsUseCase from '../use_cases/service_provider_methods.use_case.js'

@inject()
export default class ServiceProviderMethodsController {
  constructor(private readonly useCase: ServiceProviderMethodsUseCase) {}

  async index({ request, response }: HttpContext) {
    const qs = request.qs()
    const result = await this.useCase.list({
      page: Number(qs.page ?? 1),
      limit: Number(qs.limit ?? 20),
      isActive:
        qs.is_active !== undefined || qs.isActive !== undefined
          ? String(qs.is_active ?? qs.isActive) === 'true' || String(qs.is_active ?? qs.isActive) === '1'
          : undefined,
      serviceTypeId: qs.service_type_id ? Number(qs.service_type_id) : qs.serviceTypeId ? Number(qs.serviceTypeId) : undefined,
      paymentMethodId: qs.payment_method_id ? Number(qs.payment_method_id) : qs.paymentMethodId ? Number(qs.paymentMethodId) : undefined,
      providerFromId: qs.provider_from_id ? Number(qs.provider_from_id) : qs.providerFromId ? Number(qs.providerFromId) : undefined,
    })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.useCase.get(Number(params.id))
    return response.ok(item)
  }

  async store({ request, response }: HttpContext) {
    const body = request.only([
      'serviceTypeId',
      'paymentMethodId',
      'providerFromId',
      'providerToId',
      'feeFixed',
      'feePercent',
      'currency',
      'isActive',
    ])

    try {
      const created = await this.useCase.create(body)
      return response.created(created)
    } catch (error) {
      const message = (error as Error).message || 'Creation failed'
      const isBad =
        message.includes('required') ||
        message.includes('Invalid serviceTypeId') ||
        message.includes('Invalid paymentMethodId') ||
        message.includes('Invalid providerFromId') ||
        message.includes('Invalid providerToId')

      return isBad
        ? response.badRequest({ message })
        : response.conflict({
            message:
              'Creation failed. Ensure the unique combination of service_type_id, payment_method_id, provider_from_id, provider_to_id does not already exist.',
            error: String(error),
          })
    }
  }

  async update({ params, request, response }: HttpContext) {
    const body = request.only([
      'serviceTypeId',
      'paymentMethodId',
      'providerFromId',
      'providerToId',
      'feeFixed',
      'feePercent',
      'currency',
      'isActive',
    ])

    try {
      const item = await this.useCase.update(Number(params.id), body)
      return response.ok(item)
    } catch (error) {
      return response.conflict({
        message: 'Update failed. Possibly unique combination conflict or invalid foreign keys',
        error: String(error),
      })
    }
  }

  async destroy({ params, response }: HttpContext) {
    await this.useCase.delete(Number(params.id))
    return response.noContent()
  }
}
