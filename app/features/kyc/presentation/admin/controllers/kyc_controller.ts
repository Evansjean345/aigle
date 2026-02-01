import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllKycDocumentsUseCase from '#features/kyc/application/usecases/admin/get_all_kyc_documents.usecase'
import GetKycStatsUseCase from '#features/kyc/application/usecases/admin/get_kyc_stats.usecase'
import GetKycDocumentByIdUseCase from '#features/kyc/application/usecases/admin/get_kyc_document_by_id.usecase'
import GetUserKycDocumentUseCase from '#features/kyc/application/usecases/admin/get_user_kyc_document.usecase'
import ProcessKycDocumentUseCase from '#features/kyc/application/usecases/admin/process_kyc_document.usecase'
import {
  processKycErrorMessages,
  processKycValidator,
} from '#features/kyc/presentation/admin/validators/process_kyc_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'

@inject()
export default class KycController {
  /**
   * Constructor for the class.
   *
   * @param {GetAllKycDocumentsUseCase} getAllKycDocumentsUseCase - Use case for retrieving all KYC documents.
   * @param {GetKycStatsUseCase} getKycStatsUseCase - Use case for retrieving KYC statistics.
   * @param {GetKycDocumentByIdUseCase} getKycDocumentByIdUseCase - Use case for retrieving a KYC document by ID.
   * @param processKycDocumentUseCase
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
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', request.input('limit', 20))
    const status = request.input('status')
    const documentType = request.input('documentType', request.input('document_type'))
    const userId = request.input('user_id')
    const search = request.input('search')
    const startDate = request.input('start_date')
    const endDate = request.input('end_date')

    const kycDocuments = await this.getAllKycDocumentsUseCase.execute(page, perPage, {
      status,
      documentType,
      userId,
      search,
      startDate,
      endDate,
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
  async stats({ response }: HttpContext): Promise<void> {
    const stats = await this.getKycStatsUseCase.execute()
    return response.ok(stats)
  }

  /**
   * Handles the retrieval of a single KYC document by its ID.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @return {Promise<void>} A promise that resolves when the document is successfully sent in the response.
   */
  async kycDetails({ params, response }: HttpContext): Promise<void> {
    try {
      const kycDocument = await this.getKycDocumentByIdUseCase.execute(params.id)

      if (!kycDocument) {
        return response.notFound({ message: 'KYC document not found' })
      }

      return response.ok(kycDocument)
    } catch (error) {
      console.error(error)
      return response.notFound({ message: 'KYC document not found' })
    }
  }

  /**
   * Processes a KYC document (approve or reject)
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   */
  async process({ request, response, params }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(processKycValidator, {
      messagesProvider: new SimpleMessagesProvider(processKycErrorMessages),
    })

    await this.processKycDocumentUseCase.execute(params.id, payload.status, payload.comment)
    return response.ok({ message: `Document KYC ${payload.status} avec succès ✅` })
  }

  /**
   * Récupère le document KYC d'un utilisateur spécifique.
   */
  async getUserKyc({ params, response }: HttpContext): Promise<void> {
    const { id } = params
    const kycDocument = await this.getUserKycDocumentUseCase.execute(id)

    if (!kycDocument) {
      return response.ok(null)
    }

    return response.ok(kycDocument)
  }
}
