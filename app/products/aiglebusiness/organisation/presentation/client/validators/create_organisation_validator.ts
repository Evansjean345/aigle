import vine from '@vinejs/vine'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'

/**
 * Payload de création d'organisation (canal client).
 */
export const createOrganisationValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(120),
    account_type: vine.enum(Object.values(OrganisationAccountType)),
  })
)
