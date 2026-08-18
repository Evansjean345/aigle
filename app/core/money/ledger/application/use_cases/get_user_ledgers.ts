import { inject } from '@adonisjs/core'
import LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'
import AccountHolderResolver from '#core/money/transactions/application/services/account_holder_resolver'
import { LedgerDto } from '#core/money/ledger/application/dtos/admin/admin_ledger.dto'
import { type LedgerOperation } from '#core/money/ledger/domain/types/ledger_operation'

@inject()
export default class GetUserLedgersUseCase {
  /**
   * @param {LedgerRepository} ledgerRepository - The repository responsible for managing ledger-related operations.
   * @param {WalletRepository} walletRepository - The repository responsible for managing wallet-related operations.
   * @param {AccountHolderResolver} holderResolver - Résout le titulaire par `account_id` (account-centric).
   */
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly walletRepository: WalletRepository,
    private readonly holderResolver: AccountHolderResolver
  ) {}

  /**
   * Executes the process of retrieving and paginating the ledger entries for a user's wallet.
   *
   * @param {string} userId - The unique identifier of the user whose wallet ledgers are to be fetched.
   * @param {number} page - The page number for pagination of ledger entries.
   * @param {number} perPage - The number of ledger entries per page.
   * @param filters
   **/
  async execute(
    userId: string,
    page: number,
    perPage: number,
    filters?: {
      direction?: string
      operationType?: LedgerOperation
      startDate?: string
      endDate?: string
      search?: string
    }
  ): Promise<{ meta: any; data: LedgerDto[] } | null> {
    const wallet = await this.walletRepository.findByUserId(userId)

    if (!wallet) {
      return null
    }

    const paginatedLedgers = await this.ledgerRepository.findAll(page, perPage, {
      ...filters,
      walletId: wallet.id,
    })

    const ledgers = paginatedLedgers.all()
    const holders = await this.holderResolver.resolve(
      ledgers.map((ledger) => ledger.wallet?.accountId)
    )
    const data = ledgers.map((ledger) => LedgerDto.fromLedger(ledger, holders))

    return {
      meta: paginatedLedgers.getMeta(),
      data: data,
    }
  }
}
