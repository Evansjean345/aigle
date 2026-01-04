import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Exception } from '@adonisjs/core/exceptions'
import { Logger } from '@adonisjs/core/logger'
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
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly logger: Logger,
    private readonly ledgerService: LedgerService,
    private readonly contextFactory: WalletTransferContextService,
    private readonly validator: WalletTransferValidationService
  ) {}

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
      this.logger.error({ err: error }, 'Wallet-to-wallet transfer failed')
      throw error
    }
  }

  private async processTransfer(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<TransferResult> {
    const { senderWallet, recipientWallet, amount, fees, total } = context

    // Step 1: Update balances
    const [senderAfter, recipientAfter] = await Promise.all([
      this.walletService.debitBalance(senderWallet.id, total, trx),
      this.walletService.creditBalance(recipientWallet.id, amount, trx),
    ])

    if (!senderAfter || !recipientAfter) {
      this.logger.error('Failed to update balances', {
        senderWalletId: senderWallet.id,
        recipientWalletId: recipientWallet.id,
      })
      throw new Exception('Échec de la mise à jour des soldes', { status: 500 })
    }

    balances.senderAfter = senderAfter.balance
    balances.recipientAfter = recipientAfter.balance

    this.logBalancesUpdated(context, balances)

    // Step 2: Create transactions
    const [senderTx, recipientTx] = await this.createTransactions(context, balances, trx)

    // Step 3: Create payments and ledger entries in parallel
    await Promise.all([
      this.createPaymentRecord(senderTx, recipientWallet.user.phone, context.currentUser, trx),
      this.createPaymentRecord(recipientTx, senderWallet.user.phone, context.currentUser, trx),
      this.ledgerService.createEntry(
        {
          transaction: senderTx,
          walletId: senderWallet.id,
          direction: LedgerDirection.DEBIT,
          amountBrut: amount,
          fees,
          balanceAfter: balances.senderAfter,
        },
        trx
      ),
      this.ledgerService.createEntry(
        {
          transaction: recipientTx,
          walletId: recipientWallet.id,
          direction: LedgerDirection.CREDIT,
          amountBrut: amount,
          fees: 0,
          balanceAfter: balances.recipientAfter,
        },
        trx
      ),
    ])

    this.logger.info(
      { sender_tx_id: senderTx.id, recipient_tx_id: recipientTx.id, reference: senderTx.reference },
      'Transactions created for wallet-to-wallet'
    )

    return { senderTx, recipientTx, balances }
  }

  private async createTransactions(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<[Transaction, Transaction]> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = context

    const senderName = `${senderWallet.user.firstname} ${senderWallet.user.lastname}`
    const recipientName = `${recipientWallet.user.firstname} ${recipientWallet.user.lastname}`

    return Promise.all([
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

  private dispatchCompletionEvent(
    senderTx: Transaction,
    recipientTx: Transaction,
    senderWallet: Wallet,
    recipientWallet: Wallet
  ): void {
    WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
      recipienPhone: recipientWallet.user.phone,
      senderPhone: senderWallet.user.phone,
    }).catch((err) => this.logger.error({ err }, 'Failed to dispatch completion event'))
  }

  private logTransferStart(
    user: User,
    mode: TransferMode,
    payload: WalletToWalletRequestDto
  ): void {
    this.logger.info(
      {
        user_id: user.id,
        mode,
        ...(mode === TransferMode.BY_QRCODE && { qrcode: payload.token }),
        ...(mode === TransferMode.BY_PHONE && { recipient_phone: payload.recipient_phone }),
        amount: payload.amount,
      },
      'Starting wallet-to-wallet transfer'
    )
  }

  private logBalancesUpdated(context: TransferContext, balances: BalanceSnapshot): void {
    this.logger.info(
      {
        sender_wallet_id: context.senderWallet.id,
        recipient_wallet_id: context.recipientWallet.id,
        sender_balance_after: balances.senderAfter,
        recipient_balance_after: balances.recipientAfter,
        amount: context.amount,
        fees: context.fees,
      },
      'Balances updated for wallet-to-wallet'
    )
  }
}
