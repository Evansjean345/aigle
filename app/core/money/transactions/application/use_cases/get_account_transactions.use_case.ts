import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import {
  MobileTransactionResponseDTO,
  PaginatedMobileTransactionsResponseDTO,
} from '#core/money/transactions/application/dtos/mobile_transaction.dto'

/**
 * Liste paginée des transactions d'un **compte** (`account_id`) — account-centric.
 *
 * Réutilisé par les clients qui consultent l'historique d'un compte non-user, typiquement une
 * **organisation** (`account_id == organisationId`) côté aiglebusiness : le marchand voit ses
 * encaissements. Le DTO porte la taxonomie d'affichage (`display` : kind + contrepartie).
 */
@inject()
export default class GetAccountTransactionsUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  /**
   * @param accountId Compte titulaire (pour une org : l'`organisationId`).
   * @param page Page (défaut 1).
   * @param perPage Taille de page (défaut 16).
   */
  async execute(
    accountId: string,
    page: number = 1,
    perPage: number = 16
  ): Promise<PaginatedMobileTransactionsResponseDTO> {
    const paginated = await this.transactionRepository.getAllByAccountId(accountId, page, perPage)
    return MobileTransactionResponseDTO.fromPaginator(paginated)
  }
}
