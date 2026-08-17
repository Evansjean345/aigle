import { inject } from '@adonisjs/core'
import AccountService from '#core/identity/account/application/services/account_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { OrganisationProvisioningStep } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_profile.dto'
import { organisationLevelOf } from '#aiglebusiness/organisation/domain/organisation_level_mapping'

/**
 * Configure une organisation nouvellement créée : membership, compte, alias d'encaissement.
 *
 * Chaque étape a sa propre transaction et est rejouable — le membership vérifie ce qui existe,
 * l'ouverture de compte et l'enregistrement d'alias renvoient l'existant. Reprendre une
 * organisation restée en `PROVISIONING` consiste donc à tout relancer : les étapes déjà passées
 * ne font rien.
 *
 * L'ordre place le membership en premier : le propriétaire doit voir son organisation même si la
 * suite échoue, sans quoi elle lui serait invisible tout en occupant sa place.
 */
@inject()
export default class OrganisationProvisioningService {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountService: AccountService,
    private readonly payableAliasService: PayableAliasService,
    private readonly membershipService: MembershipService,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Mène la configuration à son terme et active l'organisation.
   *
   * @param {Organisation} organisation - Organisation à configurer, en `PROVISIONING`.
   * @returns {Promise<Organisation>} L'organisation active.
   */
  async provision(organisation: Organisation): Promise<Organisation> {
    const isMerchant = organisation.accountType === OrganisationAccountType.MARCHAND

    await this.membershipService.seedForNewOrganisation(
      organisation.organisationId,
      organisation.ownerUserId
    )

    const account = await this.accountService.openAccount({
      ownerType: AccountOwnerType.ORGANISATION,
      ownerRef: organisation.organisationId,
      segment: AccountSegment.ORGANISATION,
      verificationProfile: isMerchant
        ? VerificationProfile.NONE
        : VerificationProfile.IMMATRICULATION,
    })

    const level = organisationLevelOf(account.level)

    if (organisation.level !== level) {
      await this.organisationRepository.updateLevel(organisation.organisationId, level)
    }

    const payableCode = await this.payableAliasService.register(
      organisation.organisationId,
      organisation.name
    )

    if (organisation.payableCode !== payableCode) {
      await this.organisationRepository.attachPayableCode(organisation.organisationId, payableCode)
    }

    const activated = await this.organisationRepository.updateStatus(
      organisation.organisationId,
      OrganisationStatus.ACTIVE
    )

    await this.accountService.announceOpened(account)

    return activated
  }

  /**
   * Reprend la configuration d'une organisation restée en `PROVISIONING`.
   *
   * @param {string} organisationId - Organisation à reprendre.
   * @returns {Promise<Organisation>} L'organisation active.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async resume(organisationId: string): Promise<Organisation> {
    const organisation = await this.organisationRepository.findByOrganisationId(organisationId)

    if (!organisation) {
      throw new OrganisationNotFoundException()
    }

    if (organisation.status !== OrganisationStatus.PROVISIONING) {
      return organisation
    }

    return this.provision(organisation)
  }

  /**
   * Relève les étapes de configuration non abouties d'une organisation.
   *
   * Rien n'est lu dans un état stocké : chaque étape est déduite de ce qui existe, comme le fait la
   * reprise. Ce que voit le gestionnaire est donc ce sur quoi le job travaille.
   *
   * @param {Organisation} organisation - Organisation à diagnostiquer.
   * @returns {Promise<OrganisationProvisioningStep[]>} Les étapes manquantes, dans l'ordre du flux.
   */
  async diagnose(organisation: Organisation): Promise<OrganisationProvisioningStep[]> {
    const missing: OrganisationProvisioningStep[] = []

    const hasOwner = await this.membershipService.isOwner(
      organisation.organisationId,
      organisation.ownerUserId
    )

    if (!hasOwner) missing.push('membership')

    const account = await this.accountStandingService.describe(organisation.organisationId)

    if (!account) missing.push('account')

    // Le palier affiché est une projection de celui du compte : désaligné, il annonce au
    // gestionnaire des droits que l'organisation n'a pas.
    if (account && organisation.level !== organisationLevelOf(account.level)) {
      missing.push('level')
    }

    if (!organisation.payableCode) missing.push('payable_alias')

    return missing
  }
}
