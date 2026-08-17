import { inject } from '@adonisjs/core'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { AccountActivitySummaryResponseDTO } from '#core/money/transactions/application/dtos/account_activity.dto'

/**
 * Résumé d'activité d'un compte : ce qui est entré, ce qui est sorti, et les derniers mouvements.
 *
 * Les totaux viennent du grand livre, seule source qui compte les mouvements réellement passés.
 */
@inject()
export default class GetAccountActivitySummaryUseCase {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly transactionRepository: TransactionRepository
  ) {}

  /**
   * @param {string} accountId - Compte titulaire, l'organisationId` pour une entreprise.
   * @param {number} [recentLimit] - Nombre de transactions récentes à joindre.
   * @returns {Promise<AccountActivitySummaryResponseDTO>} Les totaux et les derniers mouvements.
   */
  async execute(
    accountId: string,
    recentLimit: number = 5
  ): Promise<AccountActivitySummaryResponseDTO> {
    const [activity, recent] = await Promise.all([
      this.ledgerService.getAccountActivity(accountId),
      this.transactionRepository.getAllByAccountId(accountId, 1, recentLimit),
    ])

    return AccountActivitySummaryResponseDTO.from(activity, recent.all())
  }
}
