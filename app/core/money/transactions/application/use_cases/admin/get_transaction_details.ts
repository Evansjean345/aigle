import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { AdminTransactionResponseDTO } from '#core/money/transactions/application/dto/admin_transaction.dto'
import TransactionNotFoundException from '#core/money/transactions/domain/exceptions/transaction_not_found_exception'
import AccountHolderResolver from '#core/money/transactions/application/services/account_holder_resolver'

/**
 * A use case for retrieving transaction details for admin.
 */
@inject()
export default class GetTransactionDetailsUseCase {
  /**
   * @param {TransactionRepository} transactionRepository - Repo des transactions.
   * @param {AccountHolderResolver} holderResolver - Résout la partie prenante par `account_id`
   *   (user OU marchand) — account-centric.
   * @param {WalletService} walletService - Wallet du compte (id + solde) pour l'ajustement admin,
   *   résolu par `account_id` (fonctionne aussi pour un wallet d'organisation).
   */
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly holderResolver: AccountHolderResolver,
    private readonly walletService: WalletService
  ) {}

  /**
   * Executes the process of retrieving transaction details.
   *
   * @param {string} reference - The reference of the transaction.
   * @param {Object} options - Optional parameters to control data loading.
   * @param {boolean} [options.loadLedger] - Whether to load transaction ledgers.
   * @return {Promise<AdminTransactionResponseDTO>} A promise resolving to a DTO containing the transaction details.
   */
  async execute(
    reference: string,
    options: { loadLedger?: boolean } = {}
  ): Promise<AdminTransactionResponseDTO> {
    // Account-centric : la partie prenante est résolue par `account_id`, plus par le preload `user`.
    const preloads = ['payment', 'logs', 'securityContext', 'refund']

    if (options.loadLedger) {
      preloads.push('ledgers')
    }

    let transaction = await this.transactionRepository.findByReference(reference, preloads)

    if (!transaction) {
      throw new TransactionNotFoundException("Cette transaction n'existe pas")
    }

    const holders = await this.holderResolver.resolve([transaction.accountId])

    // Wallet du compte (user OU org) pour l'ajustement admin — absent si le compte n'en a pas.
    const wallet = await this.walletService
      .getByAccountId(transaction.accountId)
      .then((w) => ({ id: Number(w.id), balance: Number(w.balance) }))
      .catch(() => undefined)

    return AdminTransactionResponseDTO.fromTransaction(transaction, holders, wallet)
  }
}
