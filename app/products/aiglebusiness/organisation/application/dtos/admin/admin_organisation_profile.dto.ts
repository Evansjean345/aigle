import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import type { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import type { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import type { OrganisationEnrichment } from '#aiglebusiness/organisation/application/services/organisation_enrichment_service'
import type { OrganisationWalletRef } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_listing.dto'
import { formatMerchantQr } from '#aiglebusiness/organisation/application/merchant_qr'

/**
 * Contrats admin de la fiche d'une organisation et du diagnostic de configuration.
 */

// ── Response (output HTTP) ──────────────────────────────────────────

/** Propriétaire d'une organisation. Les champs sont nuls si le compte n'existe plus. */
export interface OrganisationOwnerRef {
  userId: string
  firstname: string | null
  lastname: string | null
  phone: string | null
}

/** Organisation telle que la voit la fiche d'administration, propriétaire et alias résolus. */
export class OrganisationAdminResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare level: OrganisationLevel
  declare status: OrganisationStatus
  declare payableCode: string | null
  /** Lien encodé dans le QR marchand. `null` sans code payable. */
  declare payableQr: string | null
  /**
   * Encaissement ouvert ou suspendu.
   *
   * `null` quand l'organisation n'a pas d'alias payable, ce qui n'est pas la même chose qu'un
   * encaissement fermé. Ne concerne plus que les organisations créées avant que l'alias soit
   * attribué aux entreprises comme aux marchands.
   */
  declare payableActive: boolean | null
  /** Nom montré au payeur au moment du scan. */
  declare payableDisplayName: string | null
  declare owner: OrganisationOwnerRef
  /** `null` tant qu'aucun portefeuille n'a été créé pour l'organisation. */
  declare wallet: OrganisationWalletRef | null
  declare memberCount: number
  declare createdAt: string | null
  declare updatedAt: string | null

  /**
   * Construit la vue admin d'une organisation.
   *
   * @param {Organisation} organisation - Organisation chargée depuis le repository.
   * @param {OrganisationEnrichment} enrichment - Tables résolues pour la page entière.
   * @returns {OrganisationAdminResponseDTO} La vue destinée au back-office.
   */
  static fromOrganisation(
    organisation: Organisation,
    enrichment: OrganisationEnrichment
  ): OrganisationAdminResponseDTO {
    const dto = new OrganisationAdminResponseDTO()

    const owner = enrichment.owners.get(organisation.ownerUserId)
    const wallet = enrichment.wallets.get(organisation.organisationId)

    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.level = organisation.level
    dto.status = organisation.status
    dto.payableCode = organisation.payableCode
    dto.payableQr = organisation.payableCode ? formatMerchantQr(organisation.payableCode) : null

    const alias = enrichment.aliases.get(organisation.organisationId)
    dto.payableActive = alias ? alias.active : null
    dto.payableDisplayName = alias ? alias.displayName : null

    dto.owner = {
      userId: organisation.ownerUserId,
      firstname: owner?.firstname ?? null,
      lastname: owner?.lastname ?? null,
      phone: owner?.phone ?? null,
    }

    dto.wallet = wallet
      ? { balance: Number(wallet.balance), currency: wallet.currency, status: wallet.status }
      : null

    dto.memberCount = enrichment.memberCounts.get(organisation.organisationId) ?? 0
    dto.createdAt = organisation.createdAt ? organisation.createdAt.toISO() : null
    dto.updatedAt = organisation.updatedAt ? organisation.updatedAt.toISO() : null

    return dto
  }
}

/** Étape de configuration non aboutie. */
export type OrganisationProvisioningStep = 'membership' | 'account' | 'level' | 'payable_alias'

/**
 * Organisation dont la configuration n'a pas abouti, avec ce qui lui manque.
 *
 * Les étapes manquantes sont déduites de l'existant, non d'un état stocké : c'est ce que le job de
 * reprise interroge, montré tel quel au gestionnaire.
 */
export class StuckOrganisationResponseDTO {
  declare organisationId: string
  declare name: string
  declare accountType: OrganisationAccountType
  declare ownerUserId: string
  declare createdAt: string | null
  /** Âge en minutes, pour distinguer une création récente d'un blocage installé. */
  declare ageMinutes: number
  declare missingSteps: OrganisationProvisioningStep[]

  /**
   * Construit la vue depuis l'organisation et son diagnostic.
   *
   * @param {Organisation} organisation - Organisation restée en configuration.
   * @param {OrganisationProvisioningStep[]} missingSteps - Étapes non abouties.
   * @param {number} ageMinutes - Âge de l'organisation.
   * @returns {StuckOrganisationResponseDTO} La vue destinée au back-office.
   */
  static from(
    organisation: Organisation,
    missingSteps: OrganisationProvisioningStep[],
    ageMinutes: number
  ): StuckOrganisationResponseDTO {
    const dto = new StuckOrganisationResponseDTO()
    dto.organisationId = organisation.organisationId
    dto.name = organisation.name
    dto.accountType = organisation.accountType
    dto.ownerUserId = organisation.ownerUserId
    dto.createdAt = organisation.createdAt ? organisation.createdAt.toISO() : null
    dto.ageMinutes = ageMinutes
    dto.missingSteps = missingSteps

    return dto
  }
}