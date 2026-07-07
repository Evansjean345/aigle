import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import AccountProvisioningService from '#core/money/account/application/services/account_provisioning_service'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import { type CreateOrganisationCommand } from '#aiglebusiness/organisation/application/dtos/create_organisation.command'
import { OrganisationResponseDTO } from '#aiglebusiness/organisation/application/dtos/organisation.response.dto'
import OwnerKycNotVerifiedException from '#aiglebusiness/organisation/domain/exceptions/owner_kyc_not_verified_exception'
import MerchantAccountAlreadyExistsException from '#aiglebusiness/organisation/domain/exceptions/merchant_account_already_exists_exception'

/**
 * Crée une organisation business, puis ouvre son compte money (account + wallet)
 * en LEVEL_0 dormant. Le mouvement d'argent reste bloqué côté produit tant que
 * le KYB n'est pas approuvé (D4, §4.8).
 *
 * Gardes de création (§4.3) : KYC personnel valide du propriétaire, et contrainte
 * multi-org (≤ 1 marchand par user ; entreprises illimitées).
 */
@inject()
export default class CreateOrganisationUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountProvisioning: AccountProvisioningService
  ) {}

  async execute(command: CreateOrganisationCommand): Promise<OrganisationResponseDTO> {
    if (command.ownerKycStatus !== UserKycStatus.VERIFIED) {
      throw new OwnerKycNotVerifiedException()
    }

    if (command.accountType === OrganisationAccountType.MARCHAND) {
      const existingMerchants = await this.organisationRepository.countByOwnerAndType(
        command.ownerUserId,
        OrganisationAccountType.MARCHAND
      )
      if (existingMerchants > 0) {
        throw new MerchantAccountAlreadyExistsException()
      }
    }

    const organisation = await db.transaction(async (trx) => {
      const organisationId = randomUUID()

      const created = await this.organisationRepository.create(
        {
          organisationId,
          ownerUserId: command.ownerUserId,
          name: command.name,
          accountType: command.accountType,
          level: OrganisationLevel.LEVEL_0,
          status: OrganisationStatus.ACTIVE,
        },
        trx
      )

      // Ouvre le compte money de l'org (account_id = organisationId) + wallet
      // dormant, dans la même transaction.
      await this.accountProvisioning.openFor(
        AccountOwnerType.ORGANISATION,
        organisationId,
        trx
      )

      return created
    })

    return OrganisationResponseDTO.fromModel(organisation)
  }
}
