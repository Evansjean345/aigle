import TransactionService from '#services/transaction_service'
import { createDepotValidator } from '#validators/transaction'
import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'

@inject()
export default class TransactionsController {
  constructor(private transactionService: TransactionService) {} // Changer le nom ici pour éviter la confusion

  async all_by_user({ response, auth }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const transaction = await this.transactionService.all_by_user(auth)
    return response.status(transaction.code).send(transaction)
  }

  async details_by_user({ response, auth, request }: HttpContext) {
    // const payload = await createDepotValidator.validate(request.all())
    const params = request.params()
    const transaction = await this.transactionService.details_by_user(auth, params)
    return response.status(transaction.code).send(transaction)
  }

  async stream_transaction({ response, request, auth }: HttpContext) {
    const params = request.params()

    // console.log(request)

    const operation = await this.transactionService.stream_transaction(auth, params, response)
    response.header('Content-Type', 'text/event-stream')
    response.header('Cache-Control', 'no-cache')
    response.header('Connection', 'keep-alive')
    return response.send(`data: ${JSON.stringify(operation)}\r\n\r\n`)
  }
}
