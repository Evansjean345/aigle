import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#mobile/wallet/services/wallet_service'
import TransactionService from '#shared/services/transaction_service'
import PaymentService from '#shared/services/payment_service'
import User from '#shared/models/user'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionType } from '#shared/models/transaction'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDto,
} from '#mobile/operations/dto/wallet_to_wallet.dto'
import { Logger } from '@adonisjs/core/logger'
import WalletToWalletTransactionCompleted from '#mobile/operations/events/wallet_to_wallet_transaction_completed'

@inject()
export default class WalletToWalletUseCase {
  /**
   * Constructs an instance of the class with the required services.
   *
   * @param {WalletService} walletService - Handles wallet-related operations.
   * @param {TransactionService} transactionService - Manages transaction-related functionality.
   * @param {PaymentService} paymentService - Provides payment-related services.
   * @param {Logger} logger - Used for logging application events and errors.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly logger: Logger
  ) {}

  /**
   * Executes a wallet-to-wallet transfer between the sender and recipient.
   * Validates wallets, ensures the sender and recipient are different, and updates balances.
   * Transactions and payment records are created for both parties with a full logging process.
   *
   * @param {WalletToWalletRequestDto} payload - The data for the wallet-to-wallet transfer, including recipient QR code and amount.
   * @param {User} currentUser - The current authenticated user initiating the transfer.
   * @return {Promise<WalletToWalletResponseDto>} Resolves with the details of the successful transaction, including reference, status, and updated balances.
   * @throws {Exception} If either wallet is not found, if the wallets are the same, or if an error occurs during the transaction process.
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User
  ): Promise<WalletToWalletResponseDto> {
    this.logger.info(
      {
        user_id: currentUser.id,
        qrcode: payload.qrcode.slice(0, 9) + '***',
        amount: payload.amount,
      },
      'Starting wallet-to-wallet transfer'
    )

    // Resolve sender wallet from current user
    const senderWallet = await this.walletService.getByUserId(currentUser.usersUid!)

    // Resolve recipient wallet via QR code token
    const recipientWallet = await this.walletService.getByWalletToken(payload.qrcode)

    if (!senderWallet || !recipientWallet) {
      throw new Exception('Sender or recipient wallet not found', {
        status: 404,
        code: 'WALLET_NOT_FOUND',
      })
    }

    if (senderWallet.id === recipientWallet.id) {
      this.logger.error(
        {
          sender_wallet_id: senderWallet.id,
          recipient_wallet_id: recipientWallet.id,
        },
        'Sender and recipient wallets are the same, aborting  transfer'
      )
      throw new Exception('Cannot transfer to the same wallet', {
        status: 400,
        code: 'SAME_WALLET',
      })
    }

    await senderWallet.load('user')
    await recipientWallet.load('user')

    // Optional safety check: log if provided recipient_phone mismatches account phone
    if (payload.recipient_phone && payload.recipient_phone !== recipientWallet.user.phone) {
      this.logger.warn(
        {
          expected_phone: recipientWallet.user.phone,
          provided_phone: payload.recipient_phone,
          recipient_wallet_id: recipientWallet.id,
        },
        'Recipient phone mismatch between QR account and provided phone'
      )
    }

    const amount = Number(payload.amount)
    const fees = 0
    const total = amount + fees

    const senderBalanceBefore = senderWallet.balance
    const recipientBalanceBefore = recipientWallet.balance

    const trx = await db.transaction()

    try {
      // 1) Debit sender
      const senderAfter = await this.walletService.debitBalance(senderWallet.id, total, trx)
      if (!senderAfter) throw new Exception('Failed to debit sender wallet', { status: 500 })

      // 2) Credit recipient
      const recipientAfter = await this.walletService.creditBalance(recipientWallet.id, amount, trx)
      if (!recipientAfter) throw new Exception('Failed to credit recipient wallet', { status: 500 })

      this.logger.info(
        {
          sender_wallet_id: senderWallet.id,
          recipient_wallet_id: recipientWallet.id,
          sender_balance_after: senderAfter.balance,
          recipient_balance_after: recipientAfter.balance,
          amount,
          fees,
        },
        'Balances updated for wallet-to-wallet'
      )

      // 3) Create transaction for sender (debit)
      const senderTx = await this.transactionService.createTransaction(
        {
          status: 'success',
          amount: amount,
          direction: 'debit',
          total_amount: total,
          fees: fees,
          balanceAfter: senderAfter.balance,
          operation_type: 'wallet_transfert' as TransactionType,
          description: 'Wallet to Wallet transfer',
        },
        senderWallet.id,
        senderBalanceBefore,
        currentUser,
        trx
      )

      // 4) Create transaction for recipient (credit)
      const recipientTx = await this.transactionService.createTransaction(
        {
          status: 'success',
          amount: amount,
          direction: 'credit',
          total_amount: amount,
          fees: 0,
          operation_type: 'wallet_transfert' as TransactionType,
          description: `Received from ${senderWallet.user.firstname}`,
          balanceAfter: recipientAfter.balance,
        },
        recipientWallet.id,
        recipientBalanceBefore,
        recipientWallet.user,
        trx
      )

      this.logger.info(
        {
          sender_tx_id: senderTx.id,
          recipient_tx_id: recipientTx.id,
          reference: senderTx.reference,
        },
        'Transactions created for wallet-to-wallet'
      )

      // 5) Create internal payment records to store counterparty phone numbers
      await this.paymentService.createPayment(
        {
          payment_method: 'internal',
          amount: amount,
          total_amount: total,
          fees: fees,
          payment_details: {
            operator: 'wallet',
            phone:
              payload.recipient_phone.replaceAll(' ', '') ||
              recipientWallet.user.phone.replaceAll(' ', ''),
          },
          status: 'success',
          step: 'wallet_to_wallet',
        },
        senderTx,
        currentUser,
        trx
      )

      await this.paymentService.createPayment(
        {
          payment_method: 'internal',
          amount: amount,
          total_amount: amount,
          fees: 0,
          payment_details: {
            operator: 'wallet',
            phone: senderWallet.user.phone.replaceAll(' ', ''),
          },
          status: 'success',
          step: 'wallet_to_wallet',
        },
        recipientTx,
        currentUser,
        trx
      )

      this.logger.info(
        { reference: senderTx.reference, status: 'success' },
        'Wallet-to-wallet transfer completed'
      )

      await trx.commit()

      await WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
        recipienPhone: recipientWallet.user.phone,
        senderPhone: senderWallet.user.phone,
      })

      return {
        message: 'Transfert wallet-to-wallet effectué avec succès',
        data: {
          reference: senderTx.reference,
          status: 'success',
        },
      }
    } catch (error) {
      await trx.rollback()
      this.logger.error({ err: error }, 'Wallet-to-wallet transfer failed')
      throw error
    }
  }
}
