import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllKycDocumentsUseCase from '#core/kyc/application/usecases/admin/get_all_kyc_documents.usecase'
import GetKycStatsUseCase from '#core/kyc/application/usecases/admin/get_kyc_stats.usecase'
import GetKycDocumentByIdUseCase from '#core/kyc/application/usecases/admin/get_kyc_document_by_id.usecase'
import GetUserKycDocumentUseCase from '#core/kyc/application/usecases/admin/get_user_kyc_document.usecase'
import ProcessKycDocumentUseCase from '#core/kyc/application/usecases/admin/process_kyc_document.usecase'
import {
  processKycErrorMessages,
  processKycValidator,
} from '#core/kyc/presentation/admin/validators/process_kyc_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import { AuditResult } from '#core/audit/domain/enums'
import KycPolicy from '#core/kyc/presentation/admin/policies/kyc_policy'
import emitter from '@adonisjs/core/services/emitter'

@inject()
export default class KycController {
  /**
   * Constructor for the class.
   *
   * @param {GetAllKycDocumentsUseCase} getAllKycDocumentsUseCase - Use case for retrieving all KYC documents.
   * @param {GetKycStatsUseCase} getKycStatsUseCase - Use case for retrieving KYC statistics.
   * @param {GetKycDocumentByIdUseCase} getKycDocumentByIdUseCase - Use case for retrieving a KYC document by ID.
   * @param processKycDocumentUseCase
   * @param getUserKycDocumentUseCase
   */
  constructor(
    private readonly getAllKycDocumentsUseCase: GetAllKycDocumentsUseCase,
    private readonly getKycStatsUseCase: GetKycStatsUseCase,
    private readonly getKycDocumentByIdUseCase: GetKycDocumentByIdUseCase,
    private readonly processKycDocumentUseCase: ProcessKycDocumentUseCase,
    private readonly getUserKycDocumentUseCase: GetUserKycDocumentUseCase
  ) {}

  /**
   * Handles an HTTP request to retrieve a paginated list of all KYC documents with filters.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async index({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', request.input('limit', 20))
    const status = request.input('status')
    const documentType = request.input('documentType', request.input('document_type'))
    const userId = request.input('user_id')
    const search = request.input('search')
    const startDate = request.input('start_date')
    const endDate = request.input('end_date')

    await bouncer.with(KycPolicy).authorize('viewAny')

    const kycDocuments = await this.getAllKycDocumentsUseCase.execute(page, perPage, {
      status,
      documentType,
      userId,
      search,
      startDate,
      endDate,
    })

    emitter.emit('activity:audit', {
      eventCategory: 'KYC',
      targetType: 'kyc_document',
      eventAction: 'READ_KYC_DOCUMENTS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { page, perPage, status, documentType, userId, search, startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(kycDocuments)
  }

  /**
   * Handles the retrieval of KYC statistics and sends the response.
   *
   * @param {Object} HttpContext - The context object for the HTTP request.
   * @param {Object} HttpContext.response - The HTTP response object used to send the stats.
   * @return {Promise<void>} A promise that resolves when the stats are successfully sent in the response.
   */
  async stats({ response, bouncer, auth, request }: HttpContext): Promise<void> {
    await bouncer.with(KycPolicy).authorize('viewAny')
    const stats = await this.getKycStatsUseCase.execute()

    emitter.emit('activity:audit', {
      eventCategory: 'kyc',
      eventAction: 'stats',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  /**
   * Handles the retrieval of a single KYC document by its ID.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @return {Promise<void>} A promise that resolves when the document is successfully sent in the response.
   */
  async kycDetails({ params, response, bouncer, auth, request }: HttpContext): Promise<void> {
    try {
      await bouncer.with(KycPolicy).authorize('view')
      const kycDocument = await this.getKycDocumentByIdUseCase.execute(params.id)

      if (!kycDocument) {
        return response.notFound({ message: 'KYC document not found' })
      }

      emitter.emit('activity:audit', {
        eventCategory: 'kyc',
        eventAction: 'view',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'kyc_document',
        targetId: String(params.id),
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })

      return response.ok(kycDocument)
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'kyc',
        eventAction: 'view',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'kyc_document',
        targetId: String(params.id),
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message ?? 'KYC document not found',
      })
      return response.notFound({ message: 'KYC document not found' })
    }
  }

  /**
   * Processes a KYC (Know Your Customer) document based on the submitted payload and emits an audit event.
   *
   * @param {Object} context - The HTTP context containing request, response, parameters, bouncer, and authentication objects.
   * @param {Request} context.request - The HTTP request object, used to validate input and retrieve headers.
   * @param {Response} context.response - The HTTP response object, used to send responses back to the client.
   * @param {Object} context.params - The route parameters, containing the identifier for the KYC document.
   * @param {Bouncer} context.bouncer - The bouncer instance for handling authorization policies.
   * @param {Auth} context.auth - The authentication instance, containing information about the currently authenticated user.
   * @return {Promise<void>} Resolves after successfully processing the KYC document and emitting the audit event.
   */
  async process({
    request,
    response,
    params,
    bouncer,
    auth,
    geoLocation,
  }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(processKycValidator, {
      messagesProvider: new SimpleMessagesProvider(processKycErrorMessages),
    })

    if (payload.status === 'approved') {
      await bouncer.with(KycPolicy).authorize('approve')
    }

    if (payload.status === 'rejected') {
      await bouncer.with(KycPolicy).authorize('reject')
    }

    const ipAddress = geoLocation?.ip ?? request.ip()
    const userAgent = request.header('user-agent') ?? null
    const requestId = request.header('x-request-id') ?? null

    await this.processKycDocumentUseCase.execute(
      params.id,
      payload.status,
      payload.comment,
      (auth.user as any)?.id as number,
      { ipAddress, userAgent, requestId, geoLocation },
      payload.validUntil
    )

    emitter.emit('activity:audit', {
      eventCategory: 'kyc',
      eventAction: payload.status === 'approved' ? 'process.approve' : 'process.reject',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      targetType: 'kyc_document',
      targetId: String(params.id),
      requestId,
      ipAddress,
      userAgent,
      newValues: {
        status: payload.status,
        comment: payload.comment,
        validUntil: payload.validUntil,
      },
      result: AuditResult.SUCCESS,
      metadata: {
        geoCountry: geoLocation?.countryCode ?? null,
        geoCity: geoLocation?.city ?? null,
        isVpn: geoLocation?.isVpn ?? null,
      },
    })

    return response.ok({ message: `Document KYC ${payload.status} avec succès ✅` })
  }

  /**
   * Retrieves the KYC (Know Your Customer) document for a specified user.
   *
   * @param {Object} context - The HTTP context object containing request and response details.
   * @param {Object} context.params - The parameters object from the request, typically containing the user ID.
   * @param {Object} context.response - The response object used to send the result back to the client.
   * @return {Promise<void>} A promise that resolves when the KYC document retrieval and response handling are complete.
   */
  async getUserKyc({ params, response, bouncer, auth, request }: HttpContext): Promise<void> {
    await bouncer.with(KycPolicy).authorize('view')
    const { id } = params
    const kycDocument = await this.getUserKycDocumentUseCase.execute(id)

    if (!kycDocument) {
      return response.ok(null)
    }

    emitter.emit('activity:audit', {
      eventCategory: 'kyc',
      eventAction: 'view_user_kyc',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      targetType: 'user',
      targetId: id,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      result: AuditResult.SUCCESS,
    })

    return response.ok(kycDocument)
  }
}
