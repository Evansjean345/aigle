import type { Exception } from '@adonisjs/core/exceptions'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'

/**
 * Ce dont le gate a besoin : retrouver le type d'une organisation.
 *
 * Plus étroit que `OrganisationRepository', ce qui permet aux tests de fournir un double vérifié par
 * le compilateur, sans assertion de type.
 */
export interface OrganisationTypeLookup {
  findByOrganisationId(organisationId: string): Promise<Pick<Organisation, 'accountType'> | null>
}

/**
 * Vérifie qu'une organisation est de type entreprise, et lève sinon.
 *
 * Le test porte sur ` !== ENTERPRISE` : une organisation introuvable, ou un type ajouté plus tard à
 * l'énumération, est refusée par défaut.
 *
 * @param {OrganisationTypeLookup} organisations - Accès en lecture au type d'organisation.
 * @param {string} organisationId - Organisation à contrôler.
 * @param {() => Exception} onDenied - Fabrique l'exception à lever, propre à la fonctionnalité
 * appelante.
 * @returns {Promise<void>} Rien si l'organisation est une entreprise.
 * @throws {Exception} Celle produite par `onDenied'.
 */
export async function assertOrganisationIsEnterprise(
  organisations: OrganisationTypeLookup,
  organisationId: string,
  onDenied: () => Exception
): Promise<void> {
  const organisation = await organisations.findByOrganisationId(organisationId)

  if (organisation?.accountType !== OrganisationAccountType.ENTERPRISE) {
    throw onDenied()
  }
}
