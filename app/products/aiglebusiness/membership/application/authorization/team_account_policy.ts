import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import MerchantNoTeamException from '#aiglebusiness/membership/domain/exceptions/merchant_no_team_exception'

/**
 * Garde d'accès aux fonctions d'équipe (rôles/membres) : réservées aux organisations
 * de type **entreprise**. Un compte **marchand** (mono-utilisateur) ne gère pas d'équipe
 * → `403 E_MERCHANT_NO_TEAM`.
 *
 * Charge l'organisation et la **renvoie** pour réutilisation par l'appelant (évite un
 * second chargement). L'existence de l'org est garantie en amont (le membre est validé
 * par le middleware d'autorisation, org-scopé).
 */
export async function assertOrganisationAllowsTeam(
  organisationRepository: OrganisationRepository,
  organisationId: string
): Promise<Organisation | null> {
  const organisation = await organisationRepository.findByOrganisationId(organisationId)

  if (organisation?.accountType === OrganisationAccountType.MARCHAND) {
    throw new MerchantNoTeamException()
  }

  return organisation
}
