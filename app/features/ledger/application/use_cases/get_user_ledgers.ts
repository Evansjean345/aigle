import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import LedgerMapper from '#features/ledger/application/mapper/ledger.mapper'
import { LedgerDto } from '#features/ledger/application/dto/ledger.dto'
import { LedgerOperationType } from '#features/ledger/domain/ledger_enums'

@inject()
export default class GetUserLedgersUseCase {
  /**
   * Constructs an instance of the class with the provided ledger and wallet repositories.
   *
   * @param {LedgerRepository} ledgerRepository - The repository responsible for managing ledger-related operations.
   * @param {WalletRepository} walletRepository - The repository responsible for managing wallet-related operations.
   */
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly walletRepository: WalletRepository
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
      operationType?: LedgerOperationType | string
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

    const data = LedgerMapper.toDtoList(paginatedLedgers.all())

    return {
      meta: paginatedLedgers.getMeta(),
      data: data,
    }
  }
}
