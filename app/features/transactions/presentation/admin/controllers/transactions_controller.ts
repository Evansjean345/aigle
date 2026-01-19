import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllTransactionsUseCase from '#features/transactions/application/use_cases/admin/get_all_transactions'
import GetTransactionDetailsUseCase from '#features/transactions/application/use_cases/admin/get_transaction_details'
import GetUserTransactionsUseCase from '#features/transactions/application/use_cases/admin/get_user_transactions'

@inject()
export default class TransactionsController {
  /**
   * Initializes a new instance of the class with a dependency for retrieving transactions.
   *
   * @param {GetAllTransactionsUseCase} getAllTransactionsUseCase - The use case responsible for fetching all transactions.
   * @param {GetTransactionDetailsUseCase} getTransactionDetailsUseCase - The use case responsible for fetching transaction details.
   * @param {GetUserTransactionsUseCase} getUserTransactionsUseCase - The use case responsible for fetching user transactions.
   */
  constructor(
    private readonly getAllTransactionsUseCase: GetAllTransactionsUseCase,
    private readonly getTransactionDetailsUseCase: GetTransactionDetailsUseCase,
    private readonly getUserTransactionsUseCase: GetUserTransactionsUseCase
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

  async getUserTransactions({ params, request, response }: HttpContext): Promise<void> {
    const { userId } = params
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const transactions = await this.getUserTransactionsUseCase.execute(userId, page, perPage)
    return response.ok(transactions)
  }
}
