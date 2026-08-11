import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SubmitKybPieceUseCase from '#aiglebusiness/kyb/application/use_cases/submit_kyb_piece.use_case'
import GetKybFileUseCase from '#aiglebusiness/kyb/application/use_cases/get_kyb_file.use_case'
import { submitKybPieceValidator } from '#aiglebusiness/kyb/presentation/client/validators/kyb_validators'

/**
 * Dossier de vérification de l'entreprise, côté propriétaire.
 *
 * L'organisation vient de l'URL, déjà autorisée en amont par les middlewares de permission et de
 * type d'organisation.
 */
@inject()
export default class KybController {
  constructor(
    private readonly submitPiece: SubmitKybPieceUseCase,
    private readonly getFile: GetKybFileUseCase
  ) {}

  /**
   * Dépose une pièce au dossier.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} L'état du dossier après le dépôt.
   */
  async store({ request, response, params, geoLocation }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(submitKybPieceValidator)

    const result = await this.submitPiece.execute({
      organisationId: params.organisationId,
      pieceType: payload.pieceType,
      reference: payload.reference,
      document: payload.document,
      auditContext: {
        ipAddress: geoLocation?.ip ?? request.ip(),
        userAgent: request.header('user-agent') ?? null,
        requestId: request.header('x-request-id') ?? null,
        geoLocation,
      },
    })

    return response.created(result)
  }

  /**
   * Rend l'état du dossier : ce qui a été déposé, ce qui manque.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} L'état du dossier.
   */
  async show({ response, params }: HttpContext): Promise<void> {
    return response.ok(await this.getFile.execute(params.organisationId))
  }
}
