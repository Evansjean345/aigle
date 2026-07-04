import { HttpContext } from '@adonisjs/core/http'
import {
  errorMessages,
  kycDocumentValidator,
} from '#core/kyc/presentation/mobile/validators/kyc_document_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import SubmitKycDocumentUsecase from '#core/kyc/application/usecases/mobile/submit_kyc_document.usecase'
import { inject } from '@adonisjs/core'

/**
 * Controller class for handling KYC submission operations.
 */
@inject()
export default class KycSubmitionController {
  /**
   *
   * @param submitKycDocumentsUseCase
   */
  constructor(private readonly submitKycDocumentsUseCase: SubmitKycDocumentUsecase) {}

  /**
   * Submits KYC (Know Your Customer) documents for verification.
   *
   * @param {object} HttpContext - The HTTP context of the request.
   * @param {object} HttpContext.request - The HTTP request object containing user input and data.
   * @param {object} HttpContext.response - The HTTP response object used to send back a response.
   * @param {object} HttpContext.auth - The authentication object to verify user login status.
   * @return {Promise<void>} A Promise that resolves to the created KYC document response.
   */
  async submitKycDocuments({
    request,
    response,
    auth,
    geoLocation,
  }: HttpContext): Promise<void> {
    if (!(await auth.check())) return response.unauthorized()

    const payload = await request.validateUsing(kycDocumentValidator, {
      messagesProvider: new SimpleMessagesProvider(errorMessages),
    })

    const kycDocumentResponse = await this.submitKycDocumentsUseCase.execute(auth.user!!.usersUid, {
      documentRectoUrl: payload.document_recto,
      documentVersoUrl: payload.document_verso,
      documentType: payload.document_type,
      documentsSelfieUrl: payload.selfie_image,
      ipAddress: geoLocation?.ip ?? request.ip(),
      userAgent: request.header('user-agent') ?? null,
      requestId: request.header('x-request-id') ?? null,
      geoLocation,
    })

    return response.created(kycDocumentResponse)
  }
}
