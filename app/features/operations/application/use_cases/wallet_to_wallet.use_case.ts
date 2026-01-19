import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import User from '#features/users/domain/models/user'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDto,
} from '#features/operations/application/dto/wallet_to_wallet.dto'
import Wallet from '#features/wallet/domain/models/wallet'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import LedgerService from '#features/ledger/application/services/ledger_service'
import WalletTransferContextService, {
  TransferContext,
  TransferMode,
} from '#features/operations/application/services/wallet_transfer_context_service'
import WalletTransferValidationService from '#features/operations/application/services/wallet_transfer_validation_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

interface BalanceSnapshot {
  senderBefore: number
  recipientBefore: number
  senderAfter: number
  recipientAfter: number
}

interface TransferResult {
  senderTx: Transaction
  recipientTx: Transaction
  balances: BalanceSnapshot
}

@inject()
export default class WalletToWalletUseCase {

  /**
   * Creates a new wallet-to-wallet transfer use case instance.
   *
   * @param walletService
   * @param transactionService
   * @param paymentService
   * @param ledgerService
   * @param contextFactory
   * @param validator
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly contextFactory: WalletTransferContextService,
    private readonly validator: WalletTransferValidationService
  ) {}

  /**
   * Executes a wallet-to-wallet transfer, managing the transaction process and updating balances.
   * Rolls back the transaction in case of an error and logs the failure.
   *
   * @param payload - The transfer request payload containing sender and recipient details.
   * @param currentUser - The user initiating the transfer.
   * @param mode - The transfer mode (e.g., instant, scheduled).
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode
  ): Promise<WalletToWalletResponseDto> {
    this.logTransferStart(currentUser, mode, payload)

    const context = await this.contextFactory.create(payload, currentUser, mode)
    await this.validator.validate(context, mode, payload.recipient_phone)

    return this.executeTransfer(context)
  }

  /**
   * Executes a wallet-to-wallet transfer, managing the transaction process and updating balances.
   * Rolls back the transaction in case of an error and logs the failure.
   *
   * @param {TransferContext} context - The transfer context containing details about the sender and recipient wallets.
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves to an object containing the transfer status and reference on success.
   */
  private async executeTransfer(context: TransferContext): Promise<WalletToWalletResponseDto> {
    const { senderWallet, recipientWallet } = context

    const balances: BalanceSnapshot = {
      senderBefore: senderWallet.balance,
      recipientBefore: recipientWallet.balance,
      senderAfter: 0,
      recipientAfter: 0,
    }

    const trx = await db.transaction()

    try {
      const result = await this.processTransfer(context, balances, trx)
      await trx.commit()

      this.dispatchCompletionEvent(
        result.senderTx,
        result.recipientTx,
        senderWallet,
        recipientWallet
      )

      return {
        message: 'Transfert wallet-to-wallet effectué avec succès',
        data: { reference: result.senderTx.reference, status: TransactionStatus.SUCCESS },
      }
    } catch (error) {
      await trx.rollback()
      transactionLog.error(
        'WALLET_TRANSFER_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Wallet-to-wallet transfer failed'
      )
      throw error
    }
  }

  /**
   * Processes a wallet-to-wallet transfer by updating balances and creating transactions.
   * Returns a promise that resolves to an object containing the sender and recipient transactions.
   *
   * @param context - The transfer context containing sender, recipient, and transfer details.
   * @param balances - The balance snapshot before the transfer.
   * @param trx - The database transaction client for atomic operations.
   * @private
   */
  private async processTransfer(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<TransferResult> {
    const { senderWallet, recipientWallet, amount, fees, total } = context

    // Step 1: Update balances
    const [senderAfter, recipientAfter] = await Promise.all([
      // Debit the sender wallet
      this.walletService.debitBalance(senderWallet.id, total, trx),
      // Credit the recipient wallet
      this.walletService.creditBalance(recipientWallet.id, amount, trx),
    ])

    if (!senderAfter || !recipientAfter) {
      transactionLog.error(
        'BALANCE_UPDATE_FAILED',
        {
          sender: { walletId: senderWallet.id },
          recipient: { walletId: recipientWallet.id },
        },
        'Failed to update balances'
      )
      throw new Exception('Échec de la mise à jour des soldes', { status: 500 })
    }

    // Getting sender and recipient balances after updated balances
    balances.senderAfter = senderAfter.balance
    balances.recipientAfter = recipientAfter.balance

    this.logBalancesUpdated(context, balances)

    // Step 2: Create transactions
    const [senderTx, recipientTx] = await this.createTransactions(context, balances, trx)

    // Step 3: Create payments and ledger entries in parallel
    await Promise.all([
      // create the sender's transaction payment record
      this.createPaymentRecord(senderTx, recipientWallet.user.phone, context.currentUser, trx),

      // create the beneficiary's transaction payment record
      this.createPaymentRecord(recipientTx, senderWallet.user.phone, context.currentUser, trx),

      // Create the sender's ledger entry
      this.ledgerService.recordWalletTransfer(
        {
          transaction: senderTx,
          walletId: senderWallet.id,
          direction: LedgerDirection.DEBIT,
          amount: amount,
          fees,
          balanceBefore: balances.senderBefore,
          balanceAfter: balances.senderAfter,
        },
        trx
      ),

      // Create the recipient's ledger entry
      this.ledgerService.recordWalletTransfer(
        {
          transaction: recipientTx,
          walletId: recipientWallet.id,
          direction: LedgerDirection.CREDIT,
          amount: amount,
          fees: 0,
          balanceBefore: balances.recipientBefore,
          balanceAfter: balances.recipientAfter,
        },
        trx
      ),
    ])

    // Logging the transaction IDs for debugging purposes
    transactionLog.info(
      'WALLET_TRANSFER_COMPLETED',
      {
        reference: senderTx.reference,
        sender: { transactionId: senderTx.id },
        recipient: { transactionId: recipientTx.id },
      },
      'Transactions created for wallet-to-wallet'
    )

    return { senderTx, recipientTx, balances }
  }

  /**
   * Creates two transactions for the sender and recipient wallets, one for the transfer and one for the received amount.
   * Returns a promise that resolves to an array containing the sender and recipient transactions.
   *
   * @param context - The transfer context containing sender, recipient, and transfer details.
   * @param balances - The balance snapshot before the transfer.
   * @param trx - The database transaction client for atomic operations.
   * @private
   */
  private async createTransactions(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<[Transaction, Transaction]> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = context

    const senderName = `${senderWallet.user.firstname} ${senderWallet.user.lastname}`
    const recipientName = `${recipientWallet.user.firstname} ${recipientWallet.user.lastname}`

    return Promise.all([
      // create the sender transaction
      this.transactionService.createTransaction(
        {
          status: TransactionStatus.SUCCESS,
          amount,
          direction: TransactionDirection.DEBIT,
          total_amount: total,
          fees,
          balanceAfter: balances.senderAfter,
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Transfert to ${recipientName}`,
        },
        senderWallet.id,
        currentUser,
        trx
      ),

      // create the beneficiary transaction
      this.transactionService.createTransaction(
        {
          status: TransactionStatus.SUCCESS,
          amount,
          direction: TransactionDirection.CREDIT,
          total_amount: amount,
          fees: 0,
          balanceAfter: balances.recipientAfter,
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Received from ${senderName}`,
        },
        recipientWallet.id,
        recipientWallet.user,
        trx
      ),
    ])
  }

  /**
   * Creates a payment record for the sender and recipient wallets.
   * Returns a promise that resolves to the created payment record.
   *
   * @param transaction - The transaction associated with the payment.
   * @param phone - The recipient's phone number.
   * @param user - The user initiating the payment.
   * @param trx - The database transaction client for atomic operations.
   * @private
   */
  private createPaymentRecord(
    transaction: Transaction,
    phone: string,
    user: User,
    trx: TransactionClientContract
  ) {
    return this.paymentService.createPayment(
      {
        payment_method: PaymentMethod.INTERNAL,
        operation_type: TransactionType.WALLET_TRANSFERT,
        payment_details: { operator: PaymentMethod.WALLET, phone },
        status: PaymentStatus.SUCCESS,
        step: PaymentStep.WALLET_TO_WALLET,
      },
      transaction,
      user,
      trx
    )
  }

  /**
   * Dispatches a completion event for the wallet-to-wallet transfer.
   * The event contains the recipient's phone number and the sender's phone number.
   * The event is dispatched asynchronously to avoid blocking the request.
   *
   * @param senderTx - The sender's transaction.
   * @param recipientTx - The recipient's transaction.
   * @param senderWallet - The sender's wallet.
   * @param recipientWallet - The recipient's wallet.
   * @private
   */
  private dispatchCompletionEvent(
    senderTx: Transaction,
    recipientTx: Transaction,
    senderWallet: Wallet,
    recipientWallet: Wallet
  ): void {
    WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
      recipienPhone: recipientWallet.user.phone,
      senderPhone: senderWallet.user.phone,
    }).catch((err) =>
      transactionLog.error(
        'EVENT_DISPATCH_FAILED',
        { error: err instanceof Error ? err.message : 'Unknown error' },
        'Failed to dispatch completion event'
      )
    )
  }

  /**
   * Logs the start of a wallet-to-wallet transfer.
   * The logged message includes the user ID, transfer mode, recipient phone number, and transfer amount.
   *
   * @param user - The user initiating the transfer.
   * @param mode - The transfer mode (e.g., instant, scheduled).
   * @param payload - The transfer request payload containing sender and recipient details.
   * @private
   */
  private logTransferStart(
    user: User,
    mode: TransferMode,
    payload: WalletToWalletRequestDto
  ): void {
    transactionLog.info(
      'WALLET_TRANSFER_STARTED',
      {
        user: { id: user.id },
        transfer: {
          mode,
          ...(mode === TransferMode.BY_QRCODE && { qrcode: payload.token }),
          ...(mode === TransferMode.BY_PHONE && { recipientPhone: payload.recipient_phone }),
          amount: payload.amount,
        },
      },
      'Starting wallet-to-wallet transfer'
    )
  }

  /**
   * Logs the balances updated after a wallet-to-wallet transfer.
   * The logged message includes the sender and recipient wallet IDs, sender and recipient balances, and transfer amount and fees.
   *
   * @param context - The transfer context containing sender, recipient, and transfer details.
   * @param balances - The balance snapshot after the transfer.
   * @private
   */
  private logBalancesUpdated(context: TransferContext, balances: BalanceSnapshot): void {
    transactionLog.info(
      'BALANCES_UPDATED',
      {
        sender: {
          walletId: context.senderWallet.id,
          balanceAfter: balances.senderAfter,
        },
        recipient: {
          walletId: context.recipientWallet.id,
          balanceAfter: balances.recipientAfter,
        },
        transfer: {
          amount: context.amount,
          fees: context.fees,
        },
      },
      'Balances updated for wallet-to-wallet'
    )
  }
}
