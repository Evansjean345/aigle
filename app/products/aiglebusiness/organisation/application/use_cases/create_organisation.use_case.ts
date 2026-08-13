import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import { AccountVerificationStatus } from '#core/identity/kyc/domain/verification_status'
import OrganisationProvisioningService from '#aiglebusiness/organisation/application/services/organisation_provisioning_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'
import {
  type CreateOrganisationRequestDto,
  OrganisationResponseDTO,
} from '#aiglebusiness/organisation/application/dtos/organisation.dto'
import OwnerKycNotVerifiedException from '#aiglebusiness/organisation/domain/exceptions/owner_kyc_not_verified_exception'
import OrganisationAlreadyOwnedException from '#aiglebusiness/organisation/domain/exceptions/organisation_already_owned_exception'

/**
 * Crée une organisation business et achève sa configuration.
 *
 * KYB simplifié : un marchand est opérationnel dès la création, au niveau 1 ; une entreprise reste
 * au niveau 0 jusqu'à son KYB, ce qui bloque ses mouvements. Les deux reçoivent leur alias
 * d'encaissement à la création.
 *
 * Gardes de création : KYC personnel vérifié du propriétaire, et une seule organisation créée par
 * utilisateur, quel que soit son type — une organisation en cours de configuration occupe la place.
 * L'appartenance reste libre : un utilisateur peut être membre d'autant d'entreprises qu'il y est
 * invité.
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
    private readonly provisioning: OrganisationProvisioningService
  ) {}

  /**
   * Crée l'organisation et enchaîne sa configuration.
   *
   * @param {CreateOrganisationRequestDto} request - Nom, type et propriétaire.
   * @returns {Promise<OrganisationResponseDTO>} L'organisation, active si tout a abouti.
   * @throws {OwnerKycNotVerifiedException} Le KYC du propriétaire n'est pas vérifié.
   * @throws {OrganisationAlreadyOwnedException} Le propriétaire possède déjà une organisation.
   */
  async execute(request: CreateOrganisationRequestDto): Promise<OrganisationResponseDTO> {
    if (request.ownerKycStatus !== AccountVerificationStatus.VERIFIED) {
      throw new OwnerKycNotVerifiedException()
    }

    const owned = await this.organisationRepository.countByOwner(request.ownerUserId)

    if (owned > 0) {
      throw new OrganisationAlreadyOwnedException()
    }

    const isMerchant = request.accountType === OrganisationAccountType.MARCHAND

    const organisationId = randomUUID()

    const created = await this.organisationRepository.create({
      organisationId,
      ownerUserId: request.ownerUserId,
      name: request.name,
      accountType: request.accountType,
      level: isMerchant ? OrganisationLevel.LEVEL_1 : OrganisationLevel.LEVEL_0,
      status: OrganisationStatus.PROVISIONING,
      payableCode: null,
    })

    const organisation = await this.provisioning.provision(created)

    return OrganisationResponseDTO.fromModel(organisation)
  }
}
