import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
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
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import WalletToWalletTransactionFailed from '#features/operations/application/events/wallet_to_wallet_transaction_failed'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import LedgerService from '#features/ledger/application/services/ledger_service'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import WalletTransferContextService, {
  TransferContext,
  TransferMode,
} from '#features/operations/application/services/wallet_transfer_context_service'
import WalletTransferValidationService from '#features/operations/application/services/wallet_transfer_validation_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import WalletUpdateFailedException from '#features/operations/infrastructure/exceptions/wallet_update_failed_exception'
import { DeviceHeadersInfo } from '#shared/middleware/device_middleware'

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
   * Constructs an instance of the class with the specified services and dependencies.
   *
   * @param {WalletService} walletService - The service for managing wallet-related operations.
   * @param {TransactionService} transactionService - The service for processing transactions.
   * @param {PaymentService} paymentService - The service for handling payment-related functionalities.
   * @param {LedgerService} ledgerService - The service for managing ledger operations.
   * @param {WalletTransferContextService} contextFactory - The factory for creating wallet transfer contexts.
   * @param {WalletTransferValidationService} walletTransferValidationService - The service for validating wallet transfer requests.
   * @param {AccountValidationService} accountValidationService - The service for validating account-related information.
   * @param {TransactionThrottleCache} throttleCache - The cache for throttling transaction requests.
   * @param {TransactionFailureCache} failureCache - The cache for tracking failed transactions.
   * @param {IdempotencyProvider} idempotency - The provider for managing idempotency of transactions.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly contextFactory: WalletTransferContextService,
    private readonly walletTransferValidationService: WalletTransferValidationService,
    private readonly accountValidationService: AccountValidationService,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider
  ) {}

  /**
   * Executes a wallet-to-wallet transfer, managing the transaction process and updating balances.
   * Rolls back the transaction in case of an error and logs the failure.
   *
   * @param payload - The transfer request payload containing sender and recipient details.
   * @param currentUser - The user initiating the transfer.
   * @param mode - The transfer mode (e.g., instant, scheduled).
   * @param deviceInfo - The device information associated with the transfer request.
   * @param idempotencyKey - The idempotency key for the transaction.
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode,
    deviceInfo?: DeviceHeadersInfo,
    idempotencyKey?: string
  ): Promise<WalletToWalletResponseDto> {
    this.logTransferStart(currentUser, mode, payload)

    await this.failureCache.verifyNotBlocked(currentUser.usersUid)
    await this.throttleCache.verifyThrottle(currentUser.usersUid)

    await Promise.all([
      this.accountValidationService.validateDevice(currentUser, deviceInfo),
      this.accountValidationService.verifyPinForUser(currentUser, payload.pincode),
    ])

    const context = await this.contextFactory.create(payload, currentUser, mode)
    await this.walletTransferValidationService.validate(context, mode, payload.recipient_phone)

    return this.executeTransfer(context, idempotencyKey)
  }

  /**
   * Executes a wallet-to-wallet transfer, managing the transaction process and updating balances.
   * Rolls back the transaction in case of an error and logs the failure.
   *
   * @param {TransferContext} context - The transfer context containing details about the sender and recipient wallets.
   * @param idempotencyKey
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves to an object containing the transfer status and reference on success.
   */
  private async executeTransfer(
    context: TransferContext,
    idempotencyKey?: string
  ): Promise<WalletToWalletResponseDto> {
    const { senderWallet, recipientWallet } = context

    const balances: BalanceSnapshot = {
      senderBefore: senderWallet.balance,
      recipientBefore: recipientWallet.balance,
      senderAfter: 0,
      recipientAfter: 0,
    }

    const trx = await db.transaction()

    try {
      const transferResult = await this.processTransfer(context, balances, trx, idempotencyKey)
      await trx.commit()

      const responseResult = {
        message: 'Transfert wallet-to-wallet effectué avec succès',
        data: { reference: transferResult.senderTx.reference, status: TransactionStatus.SUCCESS },
      }

      if (idempotencyKey) {
        await this.idempotency.update(idempotencyKey, JSON.stringify(responseResult))
      }

      this.dispatchCompletionEvent(
        transferResult.senderTx,
        transferResult.recipientTx,
        senderWallet,
        recipientWallet
      )

      transferLog.info(
        'WALLET_TRANSFER_COMPLETED',
        {
          reference: idempotencyKey,
          sender: { transactionId: transferResult.senderTx.id },
          recipient: { transactionId: transferResult.recipientTx.id },
        },
        'Wallet-to-wallet transfer completed'
      )

      return responseResult
    } catch (error) {
      await trx.rollback()
      transferLog.error(
        'WALLET_TRANSFER_FAILED',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          user: { id: context.senderWallet.id },
        },
        'Wallet-to-wallet transfer failed'
      )

      await WalletToWalletTransactionFailed.dispatch({
        userId: context.currentUser.usersUid,
        amount: context.amount,
        recipientPhone: context.recipientWallet.user.phone,
      })

      throw error
    }
  }

  /**
   * Processes a wallet-to-wallet transfer by updating balances and creating transactions.
   * Returns a promise that resolves to an object containing the sender and recipient transactions.
   *
   * @param {TransferContext} context - The transfer context containing sender, recipient, and transfer details.
   * @param balances - The balance snapshot before the transfer.
   * @param trx - The database transaction client for atomic operations.
   * @param idempotencyKey
   * @private
   */
  private async processTransfer(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract,
    idempotencyKey?: string
  ): Promise<TransferResult> {
    // Step 1: Create Sender entries (Debit balance, Transaction, Payment, Ledger)
    const senderTx = await this.createSenderEntries(context, balances, trx, idempotencyKey)

    // Step 2: Create Recipient entries (Credit balance, Transaction, Payment, Ledger)
    const recipientTx = await this.createRecipientEntries(context, balances, trx)

    this.logBalancesUpdated(context, balances)

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
   * Creates all entries for the sender (Debit Balance, Transaction, Payment, Ledger).
   *
   * @private
   */
  private async createSenderEntries(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract,
    idempotencyKey?: string
  ): Promise<Transaction> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = context
    const senderAfter = await this.walletService.debitBalance(senderWallet.id, amount, trx)

    if (!senderAfter) {
      transactionLog.error(
        'SENDER_BALANCE_UPDATE_FAILED',
        {
          sender: { walletId: senderWallet.id },
        },
        'Failed to update sender balance'
      )
      throw new WalletUpdateFailedException('Échec du débit du compte expéditeur')
    }

    balances.senderAfter = senderAfter.balance

    const senderTx = await this.transactionService.createTransaction(
      {
        status: TransactionStatus.SUCCESS,
        amount,
        direction: TransactionDirection.DEBIT,
        total_amount: total,
        fees,
        balanceAfter: balances.senderAfter,
        operation_type: TransactionType.WALLET_TRANSFERT,
        description: `Transfert à ${recipientWallet.user.firstname} ${recipientWallet.user.lastname}`,
        idempotency: idempotencyKey,
      },
      senderWallet.id,
      currentUser,
      trx
    )

    await this.createPaymentRecord(senderTx, recipientWallet.user, trx)
    await this.ledgerService.recordWalletTransfer(
      {
        transaction: senderTx,
        walletId: senderWallet.id,
        direction: LedgerDirection.DEBIT,
        amount: total,
        fees,
        balanceBefore: balances.senderBefore,
        balanceAfter: balances.senderAfter,
      },
      trx
    )

    return senderTx
  }

  /**
   * Creates all entries for the recipient (Credit Balance, Transaction, Payment, Ledger).
   *
   * @private
   */
  private async createRecipientEntries(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<Transaction> {
    const { senderWallet, recipientWallet, total } = context

    const recipientAfter = await this.walletService.creditBalance(recipientWallet.id, total, trx)

    if (!recipientAfter) {
      transactionLog.error(
        'RECIPIENT_BALANCE_UPDATE_FAILED',
        {
          recipient: { walletId: recipientWallet.id },
        },
        'Failed to update recipient balance'
      )
      throw new WalletUpdateFailedException('Échec du crédit du compte destinataire')
    }

    balances.recipientAfter = recipientAfter.balance

    const recipientTx = await this.transactionService.createTransaction(
      {
        status: TransactionStatus.SUCCESS,
        amount: total,
        direction: TransactionDirection.CREDIT,
        total_amount: total,
        fees: 0,
        balanceAfter: balances.recipientAfter,
        operation_type: TransactionType.WALLET_TRANSFERT,
        description: `Transfert reçu de ${senderWallet.user.firstname} ${senderWallet.user.lastname}`,
      },
      recipientWallet.id,
      recipientWallet.user,
      trx
    )

    await this.createPaymentRecord(recipientTx, senderWallet.user, trx)
    await this.ledgerService.recordWalletTransfer(
      {
        transaction: recipientTx,
        walletId: recipientWallet.id,
        direction: LedgerDirection.CREDIT,
        amount: total,
        fees: 0,
        balanceBefore: balances.recipientBefore,
        balanceAfter: balances.recipientAfter,
      },
      trx
    )

    return recipientTx
  }

  /**
   * Creates a payment record for the sender and recipient wallets.
   * Returns a promise that resolves to the created payment record.
   *
   * @param transaction - The transaction associated with the payment.
   * @param user - The user initiating the payment.
   * @param trx - The database transaction client for atomic operations.
   * @private
   */
  private createPaymentRecord(
    transaction: Transaction,
    user: User,
    trx: TransactionClientContract
  ) {
    return this.paymentService.createPayment(
      {
        payment_method: PaymentMethod.INTERNAL,
        operation_type: TransactionType.WALLET_TRANSFERT,
        payment_details: {
          operator: PaymentMethod.WALLET,
          phone: user.phone,
          user: `${user.firstname} ${user.lastname}`,
        },
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
      recipientPhone: recipientWallet.user.phone,
      senderPhone: senderWallet.user.phone,
    }).catch((err) =>
      transferLog.error(
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
    transferLog.info(
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
    transferLog.info(
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
