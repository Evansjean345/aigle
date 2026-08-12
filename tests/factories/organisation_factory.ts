import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'

/** Segment, profil de vérification et niveau de départ d'une organisation, selon son type. */
const PROVISIONING = {
  [OrganisationAccountType.MARCHAND]: {
    segment: AccountSegment.MARCHAND,
    verificationProfile: VerificationProfile.NONE,
    organisationLevel: OrganisationLevel.LEVEL_1,
  },
  [OrganisationAccountType.ENTERPRISE]: {
    segment: AccountSegment.ENTERPRISE,
    verificationProfile: VerificationProfile.IMMATRICULATION,
    organisationLevel: OrganisationLevel.LEVEL_0,
  },
} as const

/**
 * Crée une organisation active, sans son compte.
 *
 * Le type détermine le niveau de départ, comme au provisioning : un marchand encaisse dès sa
 * création, une entreprise attend sa vérification.
 *
 * @param {Partial<Organisation>} [overrides] - Champs à imposer.
 * @returns {Promise<Organisation>} L'organisation persistée.
 */
export async function makeOrganisation(
  overrides: Partial<Organisation> = {}
): Promise<Organisation> {
  const accountType = overrides.accountType ?? OrganisationAccountType.MARCHAND

  const organisation = new Organisation()
  organisation.organisationId = randomUUID()
  organisation.ownerUserId = randomUUID()
  organisation.name = `Org ${randomUUID().slice(0, 8)}`
  organisation.accountType = accountType
  organisation.level = PROVISIONING[accountType].organisationLevel
  organisation.status = OrganisationStatus.ACTIVE
  organisation.payableCode = null

  Object.assign(organisation, overrides)

  return organisation.save()
}

/** Champs qu'une création par le use case accepte. */
export interface CreateOrganisationOptions {
  ownerUserId?: string
  accountType?: OrganisationAccountType
  name?: string
  ownerKycStatus?: UserKycStatus
}

/**
 * Crée une organisation en passant par le use case de création.
 *
 * À la différence de `makeOrganisation`, qui pose la ligne directement, ce chemin déclenche tout ce
 * que la création entraîne : ouverture du compte, rôle OWNER, premier membre. C'est celui qu'il faut
 * dès qu'un test s'appuie sur ces effets.
 *
 * @param {CreateOrganisationOptions} [options] - Champs à imposer.
 * @returns {Promise<string>} L'identifiant de l'organisation créée.
 */
export async function createOrganisation(options: CreateOrganisationOptions = {}): Promise<string> {
  const useCase = await app.container.make(CreateOrganisationUseCase)
  const organisation = await useCase.execute({
    ownerUserId: options.ownerUserId ?? randomUUID(),
    ownerKycStatus: options.ownerKycStatus ?? UserKycStatus.VERIFIED,
    name: options.name ?? 'Org Test',
    accountType: options.accountType ?? OrganisationAccountType.MARCHAND,
  })

  return organisation.organisationId
}

/**
 * Crée une organisation et lui ouvre son compte, comme le fait le provisioning.
 *
 * @param {Partial<Organisation>} [overrides] - Champs à imposer sur l'organisation.
 * @returns {Promise<{ organisation: Organisation; accountId: string }>} L'organisation et son compte.
 */
export async function makeOrganisationWithAccount(
  overrides: Partial<Organisation> = {}
): Promise<{ organisation: Organisation; accountId: string }> {
  const organisation = await makeOrganisation(overrides)
  const { segment, verificationProfile } = PROVISIONING[organisation.accountType]

  const accounts = await app.container.make(AccountService)
  const account = await accounts.openAccount({
    ownerType: AccountOwnerType.ORGANISATION,
    ownerRef: organisation.organisationId,
    segment,
    verificationProfile,
  })

  return { organisation, accountId: account.accountId }
}
