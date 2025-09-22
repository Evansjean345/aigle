import TransactionService from '#services/transaction_service'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import TransactionRepository from '#shared/interfaces/repositories/transaction.repository'

@inject()
export default class TransactionsController {
  constructor(private transactionRepository: TransactionRepository) {} // Changer le nom ici pour éviter la confusion

  async get_all({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    // const transaction = await this.transactionService.get_all(request, auth)
    // return response.status(transaction.code).send(transaction)
  }
  async update_status({ response, request, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    // const transaction = await this.transactionService.update_status(request, auth)
    // return response.status(transaction.code).send(transaction)
  }

  async all_by_user({ response, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    // const transaction = await this.transactionService.all_by_user(auth)
    // return response.status(transaction.code).send(transaction)
  }

  async details({ response, auth, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    // const params = request.params()
    // const transaction = await this.transactionService.details(params)
    // return response.status(transaction.code).send(transaction)
  }

  async details_by_user({ response, auth, params }: HttpContext) {
    const transaction = await this.transactionRepository.findByReference(params.reference)
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')

    return response.send(`data: ${JSON.stringify(transaction)}\r\n\r\n`)
  }

  async stream_transaction({ response, request, auth }: HttpContext) {
    // const params = request.params()
    // const operation = await this.transactionService.stream_transaction(auth, params, response)
    // response.header('Content-Type', 'text/event-stream')
    // response.header('Cache-Control', 'no-cache')
    // response.header('Connection', 'keep-alive')
    // return response.send(`data: ${JSON.stringify(operation)}\r\n\r\n`)
  }
}
