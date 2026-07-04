import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import {
  createProviderValidator,
  providerValidatorMessage,
  updateProviderValidator,
} from '#core/catalogs/presentation/admin/validators/provider_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import ProvidersUseCase from '#core/catalogs/application/use_cases/providers.use_case'
import {
  type ProviderStatus,
  type ProviderType,
} from '#core/catalogs/application/dtos/admin/admin_providers.dto'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class ProvidersController {
  /**
   * Creates an instance of the class with the specified ProvidersUseCase.
   *
   * @param {ProvidersUseCase} providersUseCase - The use case instance to be used by the class.
   */
  constructor(private readonly providersUseCase: ProvidersUseCase) {}

  /**
   * Handles the listing of resources based on query parameters from the request.
   *
   * @param {object} ctx - The HTTP context object.
   * @param {object} ctx.request - The HTTP request object containing query parameters.
   * @param {object} ctx.response - The HTTP response object to send the result.
   * @return {Promise<void>} A promise that resolves when the response has been sent.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { page = 1, limit = 20, q, type, status } = request.qs()
    const result = await this.providersUseCase.list({
      page: Number(page),
      limit: Number(limit),
      q,
      type: type as ProviderType,
      status: status as ProviderStatus,
    })

    return response.ok(result)
  }

  /**
   * Retrieves and returns an item by its ID.
   *
   * @param {Object} context - The context object.
   * @param {Object} context.params - The route parameters.
   * @param {string} context.params.id - The ID of the item to retrieve.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<Object>} A promise that resolves to the HTTP response containing the requested item.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const item = await this.providersUseCase.get(Number(params.id))
    return response.ok(item)
  }

  /**
   * Stores a new resource based on the provided request data.
   *
   * @param {object} HttpContext - The HTTP context containing the request and response objects.
   * @param {object} HttpContext.request - The HTTP request object.
   * @param {object} HttpContext.response - The HTTP response object.
   * @return {Promise<void>} Returns the created resource as a response.
   */
  async store({ request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(createProviderValidator, {
      messagesProvider: new SimpleMessagesProvider(providerValidatorMessage),
    })

    try {
      const created = await this.providersUseCase.create(payload)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_CREATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(created.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          newValues: payload as unknown as Record<string, unknown>,
          result: AuditResult.SUCCESS,
        })
        .catch((_) => {})

      return response.created(created)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_CREATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: null,
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          newValues: payload as unknown as Record<string, unknown>,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => {})
      throw error
    }
  }

  /**
   * Updates a resource with the given data and returns the updated resource.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.request - The HTTP request object.
   * @param {Object} context.response - The HTTP response object.
   * @return {void} The updated resource.
   */
  async update({ params, request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateProviderValidator, {
      messagesProvider: new SimpleMessagesProvider(providerValidatorMessage),
      meta: { providerId: Number(params.id) },
    })

    // Récupérer les valeurs avant modification pour l'audit
    const oldValues = await this.providersUseCase.get(Number(params.id))

    try {
      const item = await this.providersUseCase.update(Number(params.id), payload)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: payload as unknown as Record<string, unknown>,
          result: AuditResult.SUCCESS,
        })
        .catch((_) => {})

      return response.ok(item)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: oldValues as unknown as Record<string, unknown>,
          newValues: payload as unknown as Record<string, unknown>,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => {})
      throw error
    }
  }

  /**
   * Deletes a resource identified by the given ID and sends a no content response.
   *
   * @param {Object} HttpContext - The HTTP context.
   * @param {Object} HttpContext.params - The route parameters containing the ID of the resource to be deleted.
   * @param {Object} HttpContext.response - The HTTP response object used to send the response.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  async destroy({ params, request, response, auth }: HttpContext): Promise<void> {
    // Récupérer les valeurs avant suppression pour l'audit
    const oldValues = await this.providersUseCase.get(Number(params.id))

    try {
      await this.providersUseCase.delete(Number(params.id))

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_DELETED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: oldValues as unknown as Record<string, unknown>,
          result: AuditResult.SUCCESS,
        })
        .catch((_) => {})

      return response.noContent()
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'PROVIDER_DELETED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: oldValues as unknown as Record<string, unknown>,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => {})
      throw error
    }
  }

  /**
   * Activates the entity by setting its status to active.
   *
   * @param {HttpContext} context - The HTTP context containing params, request, response, and auth.
   * @return {Promise<void>} A promise that resolves when the activation is complete.
   */
  async activate({ params, request, response, auth }: HttpContext): Promise<void> {
    return this.changeStatus({ params, request, response, auth } as HttpContext, 'active')
  }

  /**
   * Deactivates the resource by setting its status to inactive.
   *
   * @param {HttpContext} context - The HTTP context containing request, response, params, and auth.
   * @return {Promise<void>} A promise that resolves when the deactivation is complete.
   */
  async deactivate({ params, request, response, auth }: HttpContext): Promise<void> {
    return this.changeStatus({ params, request, response, auth } as HttpContext, 'inactive')
  }

  /**
   * Changes the status of a provider and emits an audit event for the operation.
   * Determines the audit action based on the provided status, then attempts to update the provider status.
   * On success, emits a success audit event and returns an OK response with the updated provider.
   * On failure, emits a failure audit event containing the error message and rethrows the error.
   *
   * @param {HttpContext} context - The HTTP context containing route parameters, request details, response helpers, and authentication info.
   * @param {ProviderStatus} status - The new status to apply to the provider.
   * @return {Promise<void>} A promise that resolves when the response is sent or rejects if the status update fails.
   */
  private async changeStatus(
    { params, request, response, auth }: HttpContext,
    status: ProviderStatus
  ): Promise<void> {
    const action = status === 'active' ? 'PROVIDER_ACTIVATED' : 'PROVIDER_DEACTIVATED'

    // Récupérer les valeurs avant modification pour l'audit
    const oldValues = await this.providersUseCase.get(Number(params.id))

    try {
      const item = await this.providersUseCase.setStatus(Number(params.id), status)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: action,
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: { status: oldValues.status } as unknown as Record<string, unknown>,
          newValues: { status } as unknown as Record<string, unknown>,
          result: AuditResult.SUCCESS,
        })
        .catch((_) => {})

      return response.ok(item)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: action,
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'Provider',
          targetId: String(params.id),
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          oldValues: { status: oldValues.status } as unknown as Record<string, unknown>,
          newValues: { status } as unknown as Record<string, unknown>,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message,
        })
        .catch((_) => {})
      throw error
    }
  }
}
