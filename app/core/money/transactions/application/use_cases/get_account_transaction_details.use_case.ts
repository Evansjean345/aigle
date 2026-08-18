import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { MobileTransactionResponseDTO } from '#core/money/transactions/application/dtos/mobile_transaction.dto'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'

/**
 * Détail d'une transaction d'un **compte** (`account_id`), par référence — account-centric.
 *
 * Scopé au compte : un compte ne peut consulter que **ses** transactions (la recherche filtre sur
 * `account_id`, pas seulement la référence). Utilisé côté aiglebusiness (une org consulte le détail
 * d'un de ses encaissements).
 */
@inject()
export default class GetAccountTransactionDetailsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * @param accountId Compte titulaire (pour une org : l'`organisationId`).
   * @param transactionRef Référence de la transaction.
   */
  async execute(accountId: string, transactionRef: string): Promise<MobileTransactionResponseDTO> {
    const transaction = await this.transactionRepository.findByReferenceAndAccountId(
      transactionRef,
      accountId,
      ['ledgers']
    )

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    return MobileTransactionResponseDTO.fromTransaction(transaction)
  }
}
