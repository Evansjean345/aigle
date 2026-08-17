import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import type { PayableAliasResult } from '#core/qr/application/dtos/payable_alias.dto'

/**
 * Contrats admin des bascules d'une organisation : encaissement, blocage, gel du portefeuille.
 */

// ── Command (input service) ─────────────────────────────────────────

/** Intention de geler ou de dégeler le portefeuille d'une organisation. */
export interface FreezeOrganisationWalletCommand {
  organisationId: string
  /** `true` gèle le portefeuille, `false` le dégèle. */
  frozen: boolean
  /** Motif de la décision. Obligatoire : le gel arrête tout mouvement d'argent. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

/** Intention de bloquer ou de débloquer une organisation. */
export interface ChangeOrganisationStateCommand {
  organisationId: string
  /** `true` bloque, `false` débloque. */
  blocked: boolean
  /** Motif de la décision. Obligatoire : le blocage arrête l'activité entière. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

/** Intention d'ouvrir ou de suspendre l'encaissement d'une organisation. */
export interface SetPayableStatusCommand {
  organisationId: string
  /** `true` rouvre l'encaissement, `false` le suspend. */
  active: boolean
  /** Motif de la décision. Obligatoire : suspendre coupe les revenus du marchand. */
  reason: string
  /** Gestionnaire à l'origine de la décision. */
  adminId: number
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** État de l'encaissement après bascule. */
export class PayableStatusResponseDTO {
  declare code: string
  declare displayName: string
  declare active: boolean

  /**
   * Construit la réponse depuis l'alias mis à jour.
   *
   * @param {PayableAliasResult} alias - Alias tel que le core le renvoie.
   * @returns {PayableStatusResponseDTO} L'état destiné au back-office.
   */
  static fromAlias(alias: PayableAliasResult): PayableStatusResponseDTO {
    const dto = new PayableStatusResponseDTO()
    dto.code = alias.code
    dto.displayName = alias.displayName
    dto.active = alias.active

    return dto
  }
}

/** État du portefeuille d'une organisation après gel ou dégel. */
export class OrganisationWalletStateResponseDTO {
  declare organisationId: string
  declare walletStatus: WalletStatus

  /**
   * Construit la réponse depuis le statut du portefeuille mis à jour.
   *
   * @param {string} organisationId - Organisation porteuse du compte.
   * @param {WalletStatus} status - Statut du portefeuille après bascule.
   * @returns {OrganisationWalletStateResponseDTO} L'état destiné au back-office.
   */
  static fromStatus(
    organisationId: string,
    status: WalletStatus
  ): OrganisationWalletStateResponseDTO {
    const dto = new OrganisationWalletStateResponseDTO()
    dto.organisationId = organisationId
    dto.walletStatus = status

    return dto
  }
}

/** État d'une organisation après blocage ou déblocage. */
export class OrganisationStateResponseDTO {
  declare organisationId: string
  declare status: OrganisationStatus
  declare revokedSessions: number

  /**
   * Construit la réponse depuis l'organisation mise à jour.
   *
   * @param {Organisation} organisation - Organisation dans son nouvel état.
   * @param {number} revokedSessions - Sessions business effectivement révoquées.
   * @returns {OrganisationStateResponseDTO} L'état destiné au back-office.
   */
  static fromOrganisation(
    organisation: Organisation,
    revokedSessions: number
  ): OrganisationStateResponseDTO {
    const dto = new OrganisationStateResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.status = organisation.status
    dto.revokedSessions = revokedSessions

    return dto
  }
}
