import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import AccountProvisioningService from '#core/money/account/application/services/account_provisioning_service'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import {
  type CreateOrganisationRequestDto,
  OrganisationResponseDTO,
} from '#aiglebusiness/organisation/application/dtos/organisation.dto'
import OwnerKycNotVerifiedException from '#aiglebusiness/organisation/domain/exceptions/owner_kyc_not_verified_exception'
import MerchantAccountAlreadyExistsException from '#aiglebusiness/organisation/domain/exceptions/merchant_account_already_exists_exception'

/**
 * Crée une organisation business et ouvre son compte money (account + wallet).
 *
 * KYB simplifié (décision produit) : un MARCHAND est auto-LEVEL_1 à la création
 * (opérationnel tout de suite) et reçoit son alias payable (QR de comptoir). Une
 * ENTREPRISE reste en LEVEL_0 (mouvement bloqué produit jusqu'au KYB RCCM/DFE,
 * pas d'alias tant qu'elle n'encaisse pas).
 *
 * Gardes de création (§4.3) : KYC personnel valide du propriétaire, et contrainte
 * multi-org (≤ 1 marchand par user ; entreprises illimitées).
 */
@inject()
export default class CreateOrganisationUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountProvisioning: AccountProvisioningService,
    private readonly payableAliasService: PayableAliasService
  ) {}

  async execute(request: CreateOrganisationRequestDto): Promise<OrganisationResponseDTO> {
    if (request.ownerKycStatus !== UserKycStatus.VERIFIED) {
      throw new OwnerKycNotVerifiedException()
    }

    if (request.accountType === OrganisationAccountType.MARCHAND) {
      const existingMerchants = await this.organisationRepository.countByOwnerAndType(
        request.ownerUserId,
        OrganisationAccountType.MARCHAND
      )
      if (existingMerchants > 0) {
        throw new MerchantAccountAlreadyExistsException()
      }
    }

    const isMerchant = request.accountType === OrganisationAccountType.MARCHAND

    const organisation = await db.transaction(async (trx) => {
      const organisationId = randomUUID()

      // Ouvre le compte money de l'org (account_id = organisationId) + wallet.
      await this.accountProvisioning.openFor(AccountOwnerType.ORGANISATION, organisationId, trx)
      const payableCode = isMerchant
        ? await this.payableAliasService.register(organisationId, request.name, trx)
        : null

      return this.organisationRepository.create(
        {
          organisationId,
          ownerUserId: request.ownerUserId,
          name: request.name,
          accountType: request.accountType,
          level: isMerchant ? OrganisationLevel.LEVEL_1 : OrganisationLevel.LEVEL_0,
          status: OrganisationStatus.ACTIVE,
          payableCode,
        },
        trx
      )
    })

    return OrganisationResponseDTO.fromModel(organisation)
  }
}
