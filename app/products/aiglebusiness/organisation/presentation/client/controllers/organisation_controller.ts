import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import User from '#core/identity/user/domain/models/user'
import { AuditResult } from '#core/audit/domain/enums'
import { statusOfFile } from '#core/identity/kyc/domain/verification_status'
import CreateOrganisationUseCase from '#aiglebusiness/organisation/application/use_cases/create_organisation.use_case'
import ListOrganisationsUseCase from '#aiglebusiness/organisation/application/use_cases/list_organisations.use_case'
import { createOrganisationValidator } from '#aiglebusiness/organisation/presentation/client/validators/create_organisation_validator'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { businessTraceContext, emitBusinessAudit } from '#aiglebusiness/shared/business_audit'

@inject()
export default class OrganisationController {
  constructor(
    private readonly createOrganisation: CreateOrganisationUseCase,
    private readonly listOrganisations: ListOrganisationsUseCase
  ) {}

  /**
   * Crée une organisation pour l'utilisateur authentifié (marchand ou entreprise).
   */
  async store(ctx: HttpContext): Promise<void> {
    const { request, response, auth } = ctx
    const user = auth.user! as User
    const payload = await request.validateUsing(createOrganisationValidator)

    await user.load('kycDocument')

    const result = await this.createOrganisation.execute({
      ownerUserId: user.usersUid,
      ownerKycStatus: statusOfFile(user.kycDocument),
      name: payload.name,
      accountType: payload.account_type as OrganisationAccountType,
    })

    emitBusinessAudit(businessTraceContext(ctx), {
      eventCategory: 'ORGANISATION',
      eventAction: 'ORGANISATION_CREATED',
      actorId: user.usersUid,
      targetType: 'Organisation',
      targetId: result.organisationId,
      result: AuditResult.SUCCESS,
      metadata: { accountType: result.accountType, level: result.level },
    })

    return response.created(result)
  }

  /**
   * Liste les organisations possédées par l'utilisateur authentifié.
   */
  async index({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user! as User
    const result = await this.listOrganisations.execute(user.usersUid)

    return response.ok(result)
  }
}
