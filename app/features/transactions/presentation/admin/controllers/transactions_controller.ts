import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllTransactionsUseCase from '#features/transactions/application/use_cases/admin/get_all_transactions'
import GetTransactionDetailsUseCase from '#features/transactions/application/use_cases/admin/get_transaction_details'
import GetUserTransactionsUseCase from '#features/transactions/application/use_cases/admin/get_user_transactions'
import GetUserTransactionsStatsUseCase from '#features/transactions/application/use_cases/admin/get_user_transactions_stats'
import GetGlobalTransactionsStatsUseCase from '#features/transactions/application/use_cases/admin/get_global_transactions_stats'

/**
 * Controller class for handling operations related to transactions.
 */

@inject()
export default class TransactionsController {
  /**
   * Initializes a new instance of the class with a dependency for retrieving transactions.
   *
   * @param {GetAllTransactionsUseCase} getAllTransactionsUseCase - The use case responsible for fetching all transactions.
   * @param {GetTransactionDetailsUseCase} getTransactionDetailsUseCase - The use case responsible for fetching transaction details.
   * @param {GetUserTransactionsUseCase} getUserTransactionsUseCase - The use case responsible for fetching user transactions.
   * @param {GetUserTransactionsStatsUseCase} getUserTransactionsStatsUseCase
   * @param {GetGlobalTransactionsStatsUseCase} getGlobalTransactionsStatsUseCase
   */
  constructor(
    private readonly getAllTransactionsUseCase: GetAllTransactionsUseCase,
    private readonly getTransactionDetailsUseCase: GetTransactionDetailsUseCase,
    private readonly getUserTransactionsUseCase: GetUserTransactionsUseCase,
    private readonly getUserTransactionsStatsUseCase: GetUserTransactionsStatsUseCase,
    private readonly getGlobalTransactionsStatsUseCase: GetGlobalTransactionsStatsUseCase
  ) {}

  /**
   * Handles an HTTP request and performs actions to return a response.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async all({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)

    const transactions = await this.getAllTransactionsUseCase.execute(page, perPage)
    return response.ok(transactions)
  }

  /**
   * Handles an HTTP request to retrieve a single transaction by its identifier or reference.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.params - The request parameters.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const { reference } = params
    const transaction = await this.getTransactionDetailsUseCase.execute(reference)
    return response.ok(transaction)
  }

  /**
   * Handles the retrieval of a user's transactions based on provided parameters.
   *
   * @param {Object} HttpContext - The context object for the HTTP request/response.
   * @param {Object} HttpContext.params - The parameters extracted from the request.
   * @param {string} HttpContext.params.userId - The unique identifier of the user.
   * @param {Object} HttpContext.request - The HTTP request instance.
   * @param {Function} HttpContext.request.input - A method to retrieve request input values.
   * @param {number} HttpContext.request.input.page - The current page number for pagination (default is 1).
   * @param {number} HttpContext.request.input.perPage - The number of items per page for pagination (default is 16).
   * @param {Object} HttpContext.response - The HTTP response instance, used to send responses back to the client.
   * @return {Promise<void>} Resolves when the user's transactions are successfully retrieved and sent in the response.
   */
  async getUserTransactions({ params, request, response }: HttpContext): Promise<void> {
    const { id } = params
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const transactions = await this.getUserTransactionsUseCase.execute(id, page, perPage)
    return response.ok(transactions)
  }

  /**
   * Retrieves global transaction statistics.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async stats({ response }: HttpContext): Promise<void> {
    const stats = await this.getGlobalTransactionsStatsUseCase.execute()
    return response.ok(stats)
  }

  /**
   * Retrieves transaction statistics for a specific user.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.params - The request parameters.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async getUserTransactionStats({ params, response }: HttpContext): Promise<void> {
    const { id } = params
    const stats = await this.getUserTransactionsStatsUseCase.execute(id)
    return response.ok(stats)
  }
}
