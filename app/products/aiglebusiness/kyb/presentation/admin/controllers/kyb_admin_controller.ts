import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListKybFilesUseCase from '#aiglebusiness/kyb/application/use_cases/admin/list_kyb_files.use_case'
import GetKybFileForReviewUseCase from '#aiglebusiness/kyb/application/use_cases/admin/get_kyb_file_for_review.use_case'
import ProcessKybFileUseCase from '#aiglebusiness/kyb/application/use_cases/admin/process_kyb_file.use_case'
import {
  listKybFilesValidator,
  processKybFileValidator,
} from '#aiglebusiness/kyb/presentation/admin/validators/kyb_admin_validators'
import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'

/**
 * Revue des dossiers de vérification d'entreprise, côté back-office.
 */
@inject()
export default class KybAdminController {
  constructor(
    private readonly listFiles: ListKybFilesUseCase,
    private readonly getFile: GetKybFileForReviewUseCase,
    private readonly processFile: ProcessKybFileUseCase
  ) {}

  /**
   * Rend la file des dossiers d'entreprise.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} La page demandée.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { page, perPage, status } = await request.validateUsing(listKybFilesValidator)

    return response.ok(await this.listFiles.execute(page ?? 1, perPage ?? 20, { status }))
  }

  /**
   * Rend le détail d'un dossier, avec le niveau du compte.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Le dossier.
   * @throws {KycDocumentNotFoundException} Dossier inconnu.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const file = await this.getFile.execute(Number(params.id))

    if (!file) throw new KycDocumentNotFoundException()

    return response.ok(file)
  }

  /**
   * Applique une décision au dossier.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Réponse sans contenu.
   */
  async process({ params, request, response, auth }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(processKybFileValidator)

    await this.processFile.execute({
      documentId: Number(params.id),
      status: payload.status,
      comment: payload.comment,
      agentId: auth.user!.id,
      auditContext: {
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
      },
    })

    return response.noContent()
  }
}
