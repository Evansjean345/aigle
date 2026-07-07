import { type UserKycStatus } from '#core/identity/user/domain/enum'
import { type OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'

/**
 * Commande de création d'organisation, construite par la présentation à partir
 * de l'acteur authentifié (frontière par ID : usersUid + statut KYC) et du
 * payload. Le use case ne connaît pas le modèle User du core.
 */
export interface CreateOrganisationCommand {
  ownerUserId: string
  ownerKycStatus: UserKycStatus
  name: string
  accountType: OrganisationAccountType
}
