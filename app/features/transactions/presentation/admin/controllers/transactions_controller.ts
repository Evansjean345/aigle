import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllTransactionsUseCase from '#features/transactions/application/use_cases/get_all_transactions'

@inject()
export default class TransactionsController {
  /**
   * Initializes a new instance of the class with a dependency for retrieving transactions.
   *
   * @param {GetUserTransactionsUseCase} getAllTransactionsUseCase - The use case responsible for fetching all transactions.
   */
  constructor(private readonly getAllTransactionsUseCase: GetAllTransactionsUseCase) {}

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
}
