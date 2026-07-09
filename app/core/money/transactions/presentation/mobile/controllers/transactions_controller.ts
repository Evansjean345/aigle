import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetUserTransactionsUseCase from '#core/money/transactions/application/use_cases/get_user_transactions.use_case'
import GetUserTransactionDetailsUseCase from '#core/money/transactions/application/use_cases/get_user_transaction_details.use_case'
import GetTransactionQuotasUseCase from '#core/money/transactions/application/use_cases/get_transaction_quotas_use_case'

/**
 * MobileTransactionsController is responsible for handling operations related
 * to mobile user transactions, such as listing a user's transaction history.
 */
@inject()
export default class MobileTransactionsController {
  /**
   * Constructs an instance of the class with the required use cases.
   *
   * @param {GetUserTransactionsUseCase} getUserTransactions - Use case for retrieving user transactions.
   * @param {GetUserTransactionDetailsUseCase} getUserTransactionDetails - Use case for retrieving details of a specific user transaction.
   * @param {GetUserTransactionsUseCase} getTransactionQuotasUseCase - Use case for retrieving transaction quotas.
   */
  constructor(
    private readonly getUserTransactions: GetUserTransactionsUseCase,
    private readonly getUserTransactionDetails: GetUserTransactionDetailsUseCase,
    private readonly getTransactionQuotasUseCase: GetTransactionQuotasUseCase
  ) {}

  /**
   * Handles the retrieval of a list of transactions for the authenticated user
   * with an optional limit.
   *
   * @param {Object} HttpContext - The HTTP context object containing request, response, and auth.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @param {Object} HttpContext.auth - The authentication object containing user information.
   * @return {Promise<Object>} A promise that resolves to an HTTP response containing a list of transactions.
   */
  async list({ request, response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const page = request.qs().page

    const transactions = await this.getUserTransactions.execute(user.usersUid, page)
    return response.ok(transactions)
  }

  /**
   * Retrieves the transaction details for a user based on the provided reference.
   *
   * @param {Object} context - The context object containing HTTP request and response details.
   * @param {Object} context.response - The response object used to send back the result.
   * @param {Object} context.auth - The authentication object containing user information.
   * @param {Object} context.params - The parameters object containing route parameters.
   * @return {Promise<void>} A promise that resolves when the response is sent.
   */
  async details({ response, auth, params }: HttpContext): Promise<void> {
    const user = auth.user!
    const reference = params.reference

    const transaction = await this.getUserTransactionDetails.execute(user.usersUid, reference)
    return response.ok(transaction)
  }

  /**
   * Streams transaction data for a specific user and reference using server-sent events.
   *
   * @param {Object} context - The HttpContext object containing the request context.
   * @param {object} context.response - The HTTP response object used to send data to the client.
   * @param {object} context.auth - The authentication object containing the authenticated user.
   * @param {object} context.params - The route parameters.
   * @param {string} context.params.reference - The reference identifier for the transaction.
   * @return {Promise<void>} Resolves with the streamed transaction data.
   */
  async streamTransaction({ response, auth, params }: HttpContext): Promise<void> {
    const user = auth.user!
    const reference = params.reference

    const transaction = await this.getUserTransactionDetails.execute(user.usersUid, reference)

    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')

    return response.send(`data: ${JSON.stringify(transaction)}\r\n\r\n`)
  }

  /**
   * Retrieves the transaction quota for the authenticated user.
   *
   * @param {Object} context - The HTTP context for the request.
   * @param {Object} context.response - The response object to send data back to the client.
   * @param {Object} context.auth - The authentication object containing user information.
   * @return {Promise<void>} A Promise that resolves when the quota data is retrieved and sent in the response.
   */
  async getTransactionQuota({ response, auth }: HttpContext): Promise<void> {
    const user = auth.user!
    const result = await this.getTransactionQuotasUseCase.execute(user)
    return response.ok(result)
  }
}
