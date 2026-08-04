import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import AccountService from '#core/identity/account/application/services/account_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import MembershipService from '#aiglebusiness/membership/application/services/membership_service'
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
 * Crée une organisation business et achève sa configuration.
 *
 * KYB simplifié : un marchand est opérationnel dès la création, au niveau 1 ; une entreprise reste
 * au niveau 0 jusqu'à son KYB, ce qui bloque ses mouvements. Les deux reçoivent leur alias
 * d'encaissement à la création.
 *
 * Gardes de création : KYC personnel vérifié du propriétaire, et au plus un compte marchand par
 * utilisateur — une organisation en cours de configuration occupe cette place.
 *
 * La configuration se fait en étapes, chacune avec sa transaction, sans qu'aucune n'englobe les
 * autres. L'organisation naît en `PROVISIONING` et n'est activée qu'une fois toutes menées à bien ;
 * les routes scopées la refusent d'ici là. Une étape qui échoue laisse l'organisation visible et
 * reprenable, jamais à moitié créée en silence.
 */
@inject()
export default class CreateOrganisationUseCase {
  constructor(
    private readonly organisationRepository: OrganisationRepository,
    private readonly accountService: AccountService,
    private readonly payableAliasService: PayableAliasService,
    private readonly membershipService: MembershipService
  ) {}

  /**
   * Crée l'organisation et enchaîne sa configuration.
   *
   * @param {CreateOrganisationRequestDto} request - Nom, type et propriétaire.
   * @returns {Promise<OrganisationResponseDTO>} L'organisation, active si tout a abouti.
   * @throws {OwnerKycNotVerifiedException} Le KYC du propriétaire n'est pas vérifié.
   * @throws {MerchantAccountAlreadyExistsException} Le propriétaire a déjà un compte marchand.
   */
  async execute(request: CreateOrganisationRequestDto): Promise<OrganisationResponseDTO> {
    if (request.ownerKycStatus !== UserKycStatus.VERIFIED) {
      throw new OwnerKycNotVerifiedException()
    }

    const isMerchant = request.accountType === OrganisationAccountType.MARCHAND

    if (isMerchant) {
      const existingMerchants = await this.organisationRepository.countByOwnerAndType(
        request.ownerUserId,
        OrganisationAccountType.MARCHAND
      )

      if (existingMerchants > 0) {
        throw new MerchantAccountAlreadyExistsException()
      }
    }

    const organisationId = randomUUID()

    await this.organisationRepository.create({
      organisationId,
      ownerUserId: request.ownerUserId,
      name: request.name,
      accountType: request.accountType,
      level: isMerchant ? OrganisationLevel.LEVEL_1 : OrganisationLevel.LEVEL_0,
      status: OrganisationStatus.PROVISIONING,
      payableCode: null,
    })

    await this.membershipService.seedForNewOrganisation(organisationId, request.ownerUserId)

    const account = await this.accountService.openAccount({
      ownerType: AccountOwnerType.ORGANISATION,
      ownerRef: organisationId,
      segment: isMerchant ? AccountSegment.MARCHAND : AccountSegment.ENTERPRISE,
      level: isMerchant ? 1 : 0,
    })

    const payableCode = await this.payableAliasService.register(organisationId, request.name)
    await this.organisationRepository.attachPayableCode(organisationId, payableCode)

    const organisation = await this.organisationRepository.updateStatus(
      organisationId,
      OrganisationStatus.ACTIVE
    )

    await this.accountService.announceOpened(account)

    return OrganisationResponseDTO.fromModel(organisation)
  }
}
