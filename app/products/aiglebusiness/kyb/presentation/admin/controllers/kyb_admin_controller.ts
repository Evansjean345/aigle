import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListKybFilesUseCase from '#aiglebusiness/kyb/application/use_cases/admin/list_kyb_files.use_case'
import GetKybFileForReviewUseCase from '#aiglebusiness/kyb/application/use_cases/admin/get_kyb_file_for_review.use_case'
import ProcessKybFileUseCase from '#aiglebusiness/kyb/application/use_cases/admin/process_kyb_file.use_case'
import GetKybStatsUseCase from '#aiglebusiness/kyb/application/use_cases/admin/get_kyb_stats.use_case'
import {
  listKybFilesValidator,
  processKybFileValidator,
} from '#aiglebusiness/kyb/presentation/admin/validators/kyb_admin_validators'
import KycDocumentNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_document_not_found_exception'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'

/**
 * Revue des dossiers de vérification d'entreprise, côté back-office.
 */
@inject()
export default class KybAdminController {
  constructor(
    private readonly listFiles: ListKybFilesUseCase,
    private readonly getFile: GetKybFileForReviewUseCase,
    private readonly processFile: ProcessKybFileUseCase,
    private readonly getStats: GetKybStatsUseCase
  ) {}

  /**
   * Rend la file des dossiers d'entreprise.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} La page demandée.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const { page, perPage, ...filters } = await request.validateUsing(listKybFilesValidator, {
      data: request.qs(),
    })

    return response.ok(await this.listFiles.execute(page ?? 1, perPage ?? 20, filters))
  }

  /**
   * Rend les compteurs de la file.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Le nombre de dossiers par statut.
   */
  async stats({ response }: HttpContext): Promise<void> {
    return response.ok(await this.getStats.execute())
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
   * Approuve le dossier, ce qui porte le compte à son palier.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Réponse sans contenu.
   */
  async approve(context: HttpContext): Promise<void> {
    return this.decide(context, KycDocumentStatus.APPROVED)
  }

  /**
   * Refuse le dossier et rouvre la soumission. Le niveau du compte reste inchangé.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Réponse sans contenu.
   */
  async reject(context: HttpContext): Promise<void> {
    return this.decide(context, KycDocumentStatus.REJECTED)
  }

  /**
   * Applique une décision au dossier.
   *
   * La décision vient de la route empruntée, jamais du corps : chaque route porte son propre droit,
   * et un corps qui la contredirait ferait franchir une garde au nom d'une autre.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @param {KycDocumentStatus} status - Décision portée par la route.
   * @returns {Promise<void>} Réponse sans contenu.
   */
  private async decide(
    { params, request, response, auth }: HttpContext,
    status: KycDocumentStatus
  ): Promise<void> {
    const payload = await request.validateUsing(processKybFileValidator)

    await this.processFile.execute({
      documentId: Number(params.id),
      status,
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
