import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListOrganisationsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisations.use_case'
import GetOrganisationForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/get_organisation.use_case'
import SearchOrganisationsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/search_organisations.use_case'
import GetOrganisationStatsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/get_organisation_stats.use_case'
import ListOrganisationMembersForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisation_members.use_case'
import GetOrganisationWalletStatsForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/get_organisation_wallet_stats.use_case'
import ListOrganisationRolesForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/list_organisation_roles.use_case'
import SetPayableStatusForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/set_payable_status.use_case'
import ChangeOrganisationStateForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/change_organisation_state.use_case'
import FreezeOrganisationWalletForAdminUseCase from '#aiglebusiness/organisation/application/use_cases/admin/freeze_organisation_wallet.use_case'
import {
  listOrganisationsValidator,
  listOrganisationMembersValidator,
  searchOrganisationsValidator,
  setPayableStatusValidator,
  changeOrganisationStateValidator,
  freezeOrganisationWalletValidator,
} from '#aiglebusiness/organisation/presentation/admin/validators/admin_organisation_validators'

/**
 * Consultation et administration des organisations depuis l'espace admin.
 *
 * Deux écritures, chacune sous son propre droit : la bascule de l'encaissement et celle du blocage.
 * La gestion interne — membres, rôles — reste à l'organisation.
 */
@inject()
export default class AdminOrganisationsController {
  constructor(
    private readonly listOrganisations: ListOrganisationsForAdminUseCase,
    private readonly getOrganisation: GetOrganisationForAdminUseCase,
    private readonly searchOrganisations: SearchOrganisationsForAdminUseCase,
    private readonly getStats: GetOrganisationStatsForAdminUseCase,
    private readonly listMembers: ListOrganisationMembersForAdminUseCase,
    private readonly getWalletStats: GetOrganisationWalletStatsForAdminUseCase,
    private readonly setPayableStatus: SetPayableStatusForAdminUseCase,
    private readonly changeState: ChangeOrganisationStateForAdminUseCase,
    private readonly walletState: FreezeOrganisationWalletForAdminUseCase,
    private readonly listRoles: ListOrganisationRolesForAdminUseCase
  ) {}

  /** Liste paginée et filtrable de toutes les organisations, les plus récentes d'abord. */
  async index({ request, response }: HttpContext): Promise<void> {
    const filters = await request.validateUsing(listOrganisationsValidator, {
      data: request.qs(),
    })

    return response.ok(await this.listOrganisations.execute(filters))
  }

  /** Autocomplétion par nom ou code payable. */
  async search({ request, response }: HttpContext): Promise<void> {
    const { q } = await request.validateUsing(searchOrganisationsValidator, {
      data: request.qs(),
    })

    return response.ok({ data: await this.searchOrganisations.execute(q) })
  }

  /** Compteurs d'en-tête de la liste : parc entier, indépendants des filtres affichés. */
  async stats({ response }: HttpContext): Promise<void> {
    return response.ok({ data: await this.getStats.execute() })
  }

  /** Fiche d'une organisation, propriétaire et portefeuille résolus. */
  async show({ params, response }: HttpContext): Promise<void> {
    const organisation = await this.getOrganisation.execute(params.id as string)

    return response.ok({ data: organisation })
  }

  /** Membres d'une organisation, paginés, identités et rôles résolus. */
  async members({ params, request, response }: HttpContext): Promise<void> {
    const filters = await request.validateUsing(listOrganisationMembersValidator, {
      data: request.qs(),
    })

    return response.ok(await this.listMembers.execute(params.id as string, filters))
  }

  /** Portefeuille d'une organisation et son activité comptable. */
  async walletStats({ params, response }: HttpContext): Promise<void> {
    return response.ok({ data: await this.getWalletStats.execute(params.id as string) })
  }

  /**
   * Bloque ou débloque une organisation.
   *
   * Bloquer ferme l'accès de ses membres et révoque leurs sessions business.
   */
  async changeStatus({ params, request, response, auth }: HttpContext): Promise<void> {
    const { blocked, reason } = await request.validateUsing(changeOrganisationStateValidator)

    const state = await this.changeState.execute({
      organisationId: params.id as string,
      blocked,
      reason,
      adminId: auth.user!.id as number,
    })

    return response.ok({ data: state })
  }

  /**
   * Gèle le portefeuille d'une organisation.
   *
   * Un portefeuille gelé refuse tout encaissement et tout décaissement, lots de paiement déjà
   * approuvés compris.
   */
  async freezeWallet({ params, request, response, auth }: HttpContext): Promise<void> {
    const { reason } = await request.validateUsing(freezeOrganisationWalletValidator)

    const state = await this.walletState.execute({
      organisationId: params.id as string,
      frozen: true,
      reason,
      adminId: auth.user!.id as number,
    })

    return response.ok({ data: state })
  }

  /**
   * Dégèle le portefeuille d'une organisation.
   *
   * Refusé tant que l'organisation est bloquée : l'accès est rendu avant l'argent.
   */
  async unfreezeWallet({ params, request, response, auth }: HttpContext): Promise<void> {
    const { reason } = await request.validateUsing(freezeOrganisationWalletValidator)

    const state = await this.walletState.execute({
      organisationId: params.id as string,
      frozen: false,
      reason,
      adminId: auth.user!.id as number,
    })

    return response.ok({ data: state })
  }

  /**
   * Ouvre ou suspend l'encaissement d'une organisation.
   *
   * Suspendre fait refuser tout paiement présentant son QR — le drapeau est relu à chaque
   * encaissement, ce n'est pas qu'un affichage.
   */
  async setPayable({ params, request, response, auth }: HttpContext): Promise<void> {
    const { active, reason } = await request.validateUsing(setPayableStatusValidator)

    const alias = await this.setPayableStatus.execute({
      organisationId: params.id as string,
      active,
      reason,
      adminId: auth.user!.id as number,
    })

    return response.ok({ data: alias })
  }

  /** Rôles d'une organisation, permissions résolues et membres comptés. */
  async roles({ params, response }: HttpContext): Promise<void> {
    return response.ok({ data: await this.listRoles.execute(params.id as string) })
  }
}
