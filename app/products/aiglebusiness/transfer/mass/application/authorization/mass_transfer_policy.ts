import type OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import MassTransferEnterpriseOnlyException from '#aiglebusiness/transfer/mass/domain/exceptions/mass_transfer_enterprise_only_exception'

/**
 * Gate du paiement en masse (L2-D23) : réservé aux organisations **ENTERPRISE**. Tout autre type
 * (marchand) ou org introuvable → `403 E_MASS_TRANSFER_ENTERPRISE_ONLY`. Miroir de
 * `assertOrganisationAllowsTeam`, avec une sémantique propre au mass. Le niveau KYB n'entre pas ici
 * (un enterprise non vérifié est plafonné à 0 par ses limites au drain).
 */
export async function assertOrganisationCanMassTransfer(
  organisationRepository: OrganisationRepository,
  organisationId: string
): Promise<void> {
  const organisation = await organisationRepository.findByOrganisationId(organisationId)

  if (organisation?.accountType !== OrganisationAccountType.ENTERPRISE) {
    throw new MassTransferEnterpriseOnlyException()
  }
}
