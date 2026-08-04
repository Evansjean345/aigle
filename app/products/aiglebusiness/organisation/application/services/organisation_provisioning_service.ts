import { inject } from '@adonisjs/core'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'

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
    private readonly membershipService: MembershipService
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
      segment: isMerchant ? AccountSegment.MARCHAND : AccountSegment.ENTERPRISE,
      level: isMerchant ? 1 : 0,
    })

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
}
