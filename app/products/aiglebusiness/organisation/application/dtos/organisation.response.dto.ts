import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { type OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { type OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { type OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import { formatMerchantQr } from '#aiglebusiness/organisation/application/merchant_qr'

/**
 * Vue HTTP d'une organisation (sans exposer l'id interne ni les colonnes brutes).
 */
export class OrganisationResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare level: OrganisationLevel
  declare status: OrganisationStatus
  declare payableCode: string | null
  /** Payload complet à encoder dans le QR (aiglepay:merchant:<code>), ou null. */
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
