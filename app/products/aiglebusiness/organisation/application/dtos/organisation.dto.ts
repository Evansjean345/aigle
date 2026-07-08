import { type UserKycStatus } from '#core/identity/user/domain/enum'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { type OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { type OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { type OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import { formatMerchantQr } from '#aiglebusiness/organisation/application/merchant_qr'

// ── RequestDto (input use case) ─────────────────────────────────────

/**
 * Entrée de création d'organisation, construite par la présentation à partir de
 * l'acteur authentifié (frontière par ID : usersUid + statut KYC) et du payload.
 * Le use case ne connaît pas le modèle User du core.
 */
export interface CreateOrganisationRequestDto {
  ownerUserId: string
  ownerKycStatus: UserKycStatus
  name: string
  accountType: OrganisationAccountType
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class OrganisationResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare level: OrganisationLevel
  declare status: OrganisationStatus
  declare payableCode: string | null
  declare payableQr: string | null

  static fromModel(organisation: Organisation): OrganisationResponseDTO {
    const dto = new OrganisationResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.level = organisation.level
    dto.status = organisation.status
    dto.payableCode = organisation.payableCode
    dto.payableQr = organisation.payableCode ? formatMerchantQr(organisation.payableCode) : null
    return dto
  }
}
