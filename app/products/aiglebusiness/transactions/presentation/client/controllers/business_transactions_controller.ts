import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAccountTransactionsUseCase from '#core/money/transactions/application/use_cases/get_account_transactions.use_case'
import GetAccountTransactionDetailsUseCase from '#core/money/transactions/application/use_cases/get_account_transaction_details.use_case'
import GetAccountQuotasUseCase from '#core/money/transactions/application/use_cases/get_account_quotas.use_case'
import GetAccountActivitySummaryUseCase from '#core/money/transactions/application/use_cases/get_account_activity_summary.use_case'
import GetAccountActivityChartUseCase from '#core/money/transactions/application/use_cases/get_account_activity_chart.use_case'
import { accountActivityChartValidator } from '#aiglebusiness/transactions/presentation/client/validators/account_activity_chart_validator'

/**
 * Transactions d'une **organisation** (canal business). Routeur mince : l'auth + la permission
 * `transactions:view` sont gérées par le middleware `orgPermission` (route) ; ici on résout le
 * **compte** de l'org et on délègue au use case core account-centric.
 *
 * **Invariant** : pour une organisation, `account_id == organisationId`. On passe donc
 * `params.organisationId` comme `accountId` au core — le marchand ne voit que **ses** transactions.
 */
@inject()
export default class BusinessTransactionsController {
  constructor(
    private readonly getAccountTransactions: GetAccountTransactionsUseCase,
    private readonly getAccountTransactionDetails: GetAccountTransactionDetailsUseCase,
    private readonly getAccountQuotas: GetAccountQuotasUseCase,
    private readonly getAccountActivitySummary: GetAccountActivitySummaryUseCase,
    private readonly getAccountActivityChart: GetAccountActivityChartUseCase
  ) {}

  /** GET /business/organisations/:organisationId/transactions — liste paginée. */
  async list({ request, response, params }: HttpContext): Promise<void> {
    const accountId = params.organisationId as string
    const page = Number(request.qs().page ?? 1)

    const transactions = await this.getAccountTransactions.execute(accountId, page)
    return response.ok(transactions)
  }

  /** GET /business/organisations/:organisationId/transactions/:reference — détail. */
  async details({ response, params }: HttpContext): Promise<void> {
    const accountId = params.organisationId as string
    const reference = params.reference as string

    const transaction = await this.getAccountTransactionDetails.execute(accountId, reference)
    return response.ok(transaction)
  }

  /**
   * GET /business/organisations/:organisationId/transactions/quotas — plafonds & consommation du
   * compte marchand (account-centric). Pendant du `/mobile/transactions/quotas` d'aiglesend.
   */
  async quotas({ response, params }: HttpContext): Promise<void> {
    const accountId = params.organisationId as string

    const result = await this.getAccountQuotas.execute(accountId)
    return response.ok(result)
  }

  /**
   * Rend les totaux d'activité du compte et ses derniers mouvements.
   *
   * @param {HttpContext} context - Contexte de la requête.
   * @returns {Promise<void>} Les totaux entrants et sortants, et les dernières transactions.
   */
  async summary({ response, params }: HttpContext): Promise<void> {
    const accountId = params.organisationId as string

    const result = await this.getAccountActivitySummary.execute(accountId)
    return response.ok(result)
  }

  /**
   * Rend la courbe d'activité du compte sur une période, un point par jour mouvementé.
   *
   * @param {HttpContext} context - Contexte de la requête. `start_date` et `end_date` sont requis.
   * @returns {Promise<void>} La courbe, du plus ancien au plus récent.
   */
  async chart({ request, response, params }: HttpContext): Promise<void> {
    const accountId = params.organisationId as string
    const { start_date: startDate, end_date: endDate } = await request.validateUsing(
      accountActivityChartValidator,
      { data: request.qs() }
    )

    // Le grand livre compare des jours, pas des instants : `vine.date` rend un `Date`.
    const result = await this.getAccountActivityChart.execute(
      accountId,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10)
    )
    return response.ok(result)
  }
}
