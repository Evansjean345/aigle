import { inject } from '@adonisjs/core'
import TransactionRepository from '#repositories/transaction_repository'
import ResponseFormatter from '#responses/response_formatter'

@inject()
export default class TransactionService {
  constructor(protected transactionRepository: TransactionRepository) {}
  // la liste des transactions de l'utilisateur connecté
  async all_by_user(auth) {
    try {
      const user = auth.user
      let resultat = await this.transactionRepository.get_all_by_user(user)
      return resultat
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du depot",
        code: 500,
        status: false,
        error: err,
      })
    }
  }
  // détail d'une transactions de l'utilisateur connecté
  async details_by_user(auth, params) {
    try {
      const user = auth.user
      let resultat = await this.transactionRepository.get_detail_by_user(user, params)
      return resultat
    } catch (err) {
      return ResponseFormatter.create({
        message: "Une erreur lors de l'initialisation du depot",
        code: 500,
        status: false,
        error: err,
      })
    }
  }

  async stream_transaction(auth: any, params: any) {
    const user = auth.user
    const reference = params.reference

    try {
      // Récupération initiale de la transaction

      let transaction = await this.transactionRepository.get_detail_by_reference(user, reference)
      // console.log(transaction)

      return transaction
    } catch (err) {
      // En cas d'erreur, renvoyer un message d'erreur
      return {
        success: false,
        message: 'An error occurred while processing the transaction.',
        error: err.message,
      }
    }
  }

  // async v(data: DepotType) {}
}
