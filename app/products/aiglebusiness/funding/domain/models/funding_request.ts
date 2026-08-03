import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'

/**
 * Déclaration par un marchand d'un versement effectué hors plateforme, en vue de créditer le wallet
 * de son organisation.
 *
 * L'organisation et le compte de collecte sont référencés par leur identifiant applicatif, sans
 * relation ORM vers le core.
 */
export default class FundingRequest extends BaseModel {
  static table = 'funding_requests'

  @column({ isPrimary: true })
  declare id: number

  /** Référence publique, utilisée pour l'adressage HTTP. */
  @column()
  declare reference: string

  @column()
  declare organisationId: string

  /** Membre ayant effectué la déclaration. */
  @column()
  declare declaredByUserId: string

  /** Référence du compte de collecte sur lequel le marchand déclare avoir versé. */
  @column()
  declare collectionAccountReference: string

  /** Montant annoncé par le marchand, non vérifié. */
  @column()
  declare declaredAmount: number

  /**
   * Clé de l'objet sur le stockage privé.
   *
   * Jamais une URL : celle-ci est signée et expire, elle est générée au moment de servir la réponse.
   */
  @column()
  declare documentKey: string

  @column()
  declare status: FundingRequestStatus

  @column.dateTime()
  declare cancelledAt: DateTime | null

  // ── Décision du gestionnaire ────────────────────────────────────────────

  /** Montant constaté par le gestionnaire, et réellement crédité. `null` tant que non traité. */
  @column()
  declare verifiedAmount: number | null

  /** Gestionnaire ayant validé ou refusé la demande. */
  @column()
  declare reviewedByAdminId: number | null

  @column.dateTime()
  declare reviewedAt: DateTime | null

  /**
   * Motif de la décision qui clôt le dossier. Obligatoire en cas de refus.
   *
   * Distinct de `firstApprovalComment` : les deux gestionnaires peuvent commenter, et le second ne
   * doit pas effacer le constat du premier.
   */
  @column()
  declare reviewComment: string | null

  /** Commentaire du premier valideur, quand deux valideurs sont exigés. */
  @column()
  declare firstApprovalComment: string | null

  /**
   * Gestionnaire ayant constaté le montant et demandé le crédit, quand deux valideurs sont exigés.
   *
   * Nul lorsqu'un seul valideur a suffi.
   */
  @column()
  declare firstApprovedByAdminId: number | null

  @column.dateTime()
  declare firstApprovedAt: DateTime | null

  /** Seuil de double validation en vigueur au moment de la décision. */
  @column()
  declare approvalThresholdApplied: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** Indique si le marchand peut encore annuler la demande. */
  get isCancellable(): boolean {
    return this.status === FundingRequestStatus.PENDING
  }

  /** Indique si un gestionnaire peut encore valider ou refuser la demande. */
  get isReviewable(): boolean {
    return this.status === FundingRequestStatus.PENDING
  }

  /** Indique si la demande attend la confirmation d'un second gestionnaire. */
  get awaitsSecondApproval(): boolean {
    return this.status === FundingRequestStatus.PENDING_SECOND_APPROVAL
  }

  /**
   * Indique si la demande peut être refusée : à son arrivée comme après une première approbation.
   *
   * Un rejet reste possible au second stade, c'est le sens du second regard.
   */
  get isRejectable(): boolean {
    return this.isReviewable || this.awaitsSecondApproval
  }
}
