import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListSpmUseCase from '#features/catalogs/application/use_cases/service_provider_methods/list_spm_use_case'
import GetSpmUseCase from '#features/catalogs/application/use_cases/service_provider_methods/get_spm_use_case'
import CreateSpmUseCase from '#features/catalogs/application/use_cases/service_provider_methods/create_spm_use_case'
import UpdateSpmUseCase from '#features/catalogs/application/use_cases/service_provider_methods/update_spm_use_case'
import DeleteSpmUseCase from '#features/catalogs/application/use_cases/service_provider_methods/delete_spm_use_case'
import {
  createServiceProviderMethodValidator,
  serviceProviderMethodValidatorMessage,
  updateServiceProviderMethodValidator,
} from '#features/catalogs/presentation/admin/validators/service_provider_method_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

@inject()
export default class ServiceProviderMethodsController {
  /**
   * Constructs an instance of the class.
   *
   * @param {ListSpmUseCase} listUseCase
   * @param {GetSpmUseCase} getUseCase
   * @param {CreateSpmUseCase} createUseCase
   * @param {UpdateSpmUseCase} updateUseCase
   * @param {DeleteSpmUseCase} deleteUseCase
   */
  constructor(
    private readonly listUseCase: ListSpmUseCase,
    private readonly getUseCase: GetSpmUseCase,
    private readonly createUseCase: CreateSpmUseCase,
    private readonly updateUseCase: UpdateSpmUseCase,
    private readonly deleteUseCase: DeleteSpmUseCase
  ) {}

  /**
   * Handles the request to list items with optional query parameters for filtering and pagination.
   *
   * @param {Object} context - The HTTP context for the request.
   * @param {Object} context.request - The HTTP request object containing query parameters.
   * @param {Object} context.response - The HTTP response object used to send back the response.
   * @return {Promise<void>} The response object with the list of items and their metadata.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const qs = request.qs()

    const isActive =
      qs.is_active !== undefined || qs.isActive !== undefined
        ? String(qs.is_active ?? qs.isActive) === 'true' ||
          String(qs.is_active ?? qs.isActive) === '1'
        : undefined

    // Déterminer le filtre réseau (inter/intra)
    const networkType =
      qs.network_type || qs.networkType
        ? (String(qs.network_type ?? qs.networkType) as 'inter' | 'intra')
        : undefined

    const result = await this.listUseCase.execute({
      page: Number(qs.page ?? 1),
      limit: Number(qs.limit ?? 100),
      isActive,
      serviceTypeId: qs.service_type_id
        ? Number(qs.service_type_id)
        : qs.serviceTypeId
          ? Number(qs.serviceTypeId)
          : undefined,
      paymentMethodId: qs.payment_method_id
        ? Number(qs.payment_method_id)
        : qs.paymentMethodId
          ? Number(qs.paymentMethodId)
          : undefined,
      providerFromId: qs.provider_from_id
        ? Number(qs.provider_from_id)
        : qs.providerFromId
          ? Number(qs.providerFromId)
          : undefined,
      providerToId: qs.provider_to_id
        ? Number(qs.provider_to_id)
        : qs.providerToId
          ? Number(qs.providerToId)
          : undefined,
      networkType,
    })
    return response.ok(result)
  }

  async show({ params, response }: HttpContext) {
    const item = await this.getUseCase.execute(Number(params.id))
    return response.ok(item)
  }

  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createServiceProviderMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(serviceProviderMethodValidatorMessage),
    })

    try {
      const created = await this.createUseCase.execute(payload)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'SPM_CREATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
          targetId: String(created.id ?? ''),
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
          eventAction: 'SPM_CREATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
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

  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateServiceProviderMethodValidator, {
      messagesProvider: new SimpleMessagesProvider(serviceProviderMethodValidatorMessage),
      meta: { spmId: Number(params.id) },
    })

    // Récupérer les valeurs avant modification pour l'audit
    const oldValues = await this.getUseCase.execute(Number(params.id))

    try {
      const item = await this.updateUseCase.execute(Number(params.id), payload)

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'SPM_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
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
          eventAction: 'SPM_UPDATED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
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

  async destroy({ params, request, response, auth }: HttpContext) {
    // Récupérer les valeurs avant suppression pour l'audit
    const oldValues = await this.getUseCase.execute(Number(params.id))

    try {
      await this.deleteUseCase.execute(Number(params.id))

      emitter
        .emit('activity:audit', {
          eventCategory: 'CATALOG',
          eventAction: 'SPM_DELETED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
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
          eventAction: 'SPM_DELETED',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'ServiceProviderMethod',
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
}
