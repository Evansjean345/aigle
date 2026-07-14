import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAccountTransactionsUseCase from '#core/money/transactions/application/use_cases/get_account_transactions.use_case'
import GetAccountTransactionDetailsUseCase from '#core/money/transactions/application/use_cases/get_account_transaction_details.use_case'

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
    private readonly getAccountTransactionDetails: GetAccountTransactionDetailsUseCase
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
}
