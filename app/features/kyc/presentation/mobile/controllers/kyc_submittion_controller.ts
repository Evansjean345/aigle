import { HttpContext } from '@adonisjs/core/http'
import {
  errorMessages,
  kycDocumentValidator,
  kycSelfiValidator,
  selfiErrorMessages,
} from '#features/kyc/presentation/mobile/validators/kyc_document_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import SubmitKycDocumentUsecase from '#features/kyc/application/usecases/submit_kyc_document.usecase'
import { inject } from '@adonisjs/core'
import SubmitKycSelfiUsecase from '#features/kyc/application/usecases/submit_kyc_selfi.usecase'

/**
 * Controller class for handling KYC submission operations.
 */
@inject()
export default class KycSubmitionController {
  /**
   *
   * @param submitKycDocumentsUseCase
   * @param submitKycSelfiUsecase
   */
  constructor(
    private readonly submitKycDocumentsUseCase: SubmitKycDocumentUsecase,
    private readonly submitKycSelfiUsecase: SubmitKycSelfiUsecase
  ) {}

  /**
   * Submits KYC documents for a user.
   * @param request
   * @param response
   * @param auth
   */
  async submitKycDocuments({ request, response, auth }: HttpContext) {
    if (!(await auth.check())) return response.unauthorized()

    const payload = await request.validateUsing(kycDocumentValidator, {
      messagesProvider: new SimpleMessagesProvider(errorMessages),
    })

    const kycDocumentResponse = await this.submitKycDocumentsUseCase.execute(auth.user!!.usersUid, {
      documentRectoUrl: payload.document_recto,
      documentVersoUrl: payload.document_verso,
      documentType: payload.document_type,
    })

    return response.created(kycDocumentResponse)
  }

  /**
   * Submits a selfie image for KYC verification.
   * @param request
   * @param response
   * @param auth
   * @returns {Promise<void>}
   */
  async submitKycSelfie({ request, response, auth }: HttpContext): Promise<void> {
    if (!(await auth.check())) return response.unauthorized()
    const payload = await request.validateUsing(kycSelfiValidator, {
      messagesProvider: new SimpleMessagesProvider(selfiErrorMessages),
    })

    const kycSelfieResponse = await this.submitKycSelfiUsecase.execute(
      auth.user!!.usersUid,
      payload.selfie_image
    )

    response.created(kycSelfieResponse)
  }
}
