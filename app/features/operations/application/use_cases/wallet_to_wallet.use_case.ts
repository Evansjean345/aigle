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
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDto,
} from '#features/operations/application/dto/wallet_to_wallet.dto'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import { normalizePhone } from '#shared/utils/utiles'
import UserRepository from '#features/users/domain/interfaces/user_repository'
import Wallet from '#features/wallet/domain/models/wallet'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import QrJwtService from '#features/qr/application/services/qr_jwt_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import Payment from '#features/transactions/domain/models/payment'

type TransferMode = 'by_qrcode' | 'by_phone'

interface TransferContext {
  senderWallet: Wallet
  recipientWallet: Wallet
  amount: number
  fees: number
  total: number
  currentUser: User
}

interface BalanceSnapshot {
  senderBefore: number
  recipientBefore: number
  senderAfter: number
  recipientAfter: number
}

@inject()
export default class WalletToWalletUseCase {
  /**
   * Constructs an instance of the class by injecting required services and repositories.
   *
   * @param {WalletService} walletService - Service for managing user wallets and related operations.
   * @param {TransactionService} transactionService - Service for handling transactions and payment processing.
   * @param {PaymentService} paymentService - Service for managing payment operations and integrations.
   * @param {CountryRepository} countryRepository - Repository for managing country-related data and configurations.
   * @param {Logger} logger - Service for logging application events and errors.
   * @param {AccountValidationService} accountValidationService - Service for validating user accounts and credentials.
   * @param {TransactionLimitValidationService} transactionLimitValidationService - Service for validating transaction limits and rules.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly countryRepository: CountryRepository,
    private readonly logger: Logger,
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService
  ) {}

  /**
   * Executes a wallet-to-wallet transfer operation based on the provided payload, the current user, and the transfer mode.
   *
   * @param {WalletToWalletRequestDto} payload - The details of the transfer request including sender, receiver, and amount.
   * @param {User} currentUser - The user initiating the transfer operation.
   * @param {TransferMode} mode - The mode in which the transfer is to be executed (e.g., instant, scheduled).
   * @return {Promise<WalletToWalletResponseDto>} - A promise that resolves to the response of the wallet-to-wallet transfer, including status and any relevant details.
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode
  ): Promise<WalletToWalletResponseDto> {
    this.logTransferStart(currentUser, mode, payload)

    const context = await this.prepareTransferContext(payload, currentUser, mode)
    await this.validateTransferParties(context)

    return this.executeTransfer(context)
  }

  /**
   * Prepares the transfer context by resolving wallets, validating them, and calculating transfer details.
   *
   * @param payload The details of the wallet-to-wallet transfer request.
   * @param currentUser The user initiating the transfer.
   * @param mode The transfer mode, indicating how the recipient should be resolved.
   * @return A `TransferContext` object containing sender and recipient wallets, transfer amounts, and other related details.
   */
  private async prepareTransferContext(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode
  ): Promise<TransferContext> {
    const [senderWallet, senderCountry] = await Promise.all([
      this.walletService.getByUserId(currentUser.usersUid!),
      this.countryRepository.findCountryBy('id', currentUser.countryId),
    ])

    const recipientWallet = await this.resolveRecipient(
      mode,
      payload,
      currentUser.usersUid!,
      senderCountry.phoneCode
    )

    this.validateWallets(senderWallet, recipientWallet)
    await this.ensureWalletsUsersLoaded(senderWallet, recipientWallet)

    this.logRecipientPhoneMismatch(mode, payload.recipient_phone, recipientWallet)

    const amount = this.parseAndValidateAmount(payload.amount)

    return {
      senderWallet,
      recipientWallet,
      amount,
      fees: 0,
      total: amount, // amount + fees
      currentUser,
    }
  }

  /**
   * Validates the parties involved in a transfer operation.
   * Ensures that both the sender and recipient meet the necessary conditions for the transfer.
   *
   * @param {TransferContext} context - The context of the transfer containing the current user, recipient wallet, and transfer amount.
   * @return {Promise<void>} A promise that resolves when the validation is complete.
   */
  private async validateTransferParties(context: TransferContext): Promise<void> {
    const { currentUser, recipientWallet, amount } = context

    await this.validateUserForTransfer(currentUser, amount, TransactionDirection.DEBIT)
    await this.validateUserForTransfer(recipientWallet.user, amount, TransactionDirection.CREDIT)
  }

  /**
   * Validates whether the user is eligible to perform a wallet transfer transaction.
   *
   * @param {User} user - The user initiating the transfer operation.
   * @param {number} amount - The amount to be transferred.
   * @param {TransactionDirection} direction - The direction of the transaction (e.g., incoming or outgoing).
   * @return {Promise<void>} A promise that resolves when the validation is complete.
   */
  private async validateUserForTransfer(
    user: User,
    amount: number,
    direction: TransactionDirection
  ): Promise<void> {
    await this.accountValidationService.validateAccount(user)
    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction,
    })
  }

  /**
   * Executes a wallet-to-wallet transfer by debiting the sender's wallet and crediting the recipient's wallet.
   * The method ensures transactional integrity and creates the corresponding transactions and payments.
   *
   * @param {TransferContext} context - The transfer context containing details about the sender, recipient, amount, fees, total, and the current user.
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves to a response object containing the transfer result details.
   */
  private async executeTransfer(context: TransferContext): Promise<WalletToWalletResponseDto> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = context

    const balances: BalanceSnapshot = {
      senderBefore: senderWallet.balance,
      recipientBefore: recipientWallet.balance,
      senderAfter: 0,
      recipientAfter: 0,
    }

    const trx = await db.transaction()

    try {
      // Mise à jour des soldes en parallèle
      const [senderAfter, recipientAfter] = await Promise.all([
        this.walletService.debitBalance(senderWallet.id, total, trx),
        this.walletService.creditBalance(recipientWallet.id, amount, trx),
      ])

      if (!senderAfter || !recipientAfter) {
        throw new Exception('Échec de la mise à jour des soldes', { status: 500 })
      }

      balances.senderAfter = senderAfter.balance
      balances.recipientAfter = recipientAfter.balance

      this.logBalancesUpdated(context, balances)

      // Création des transactions et paiements
      const [senderTx, recipientTx] = await this.createTransactionsAndPayments(
        context,
        balances,
        trx
      )

      await trx.commit()
      this.dispatchCompletionEvent(senderTx, recipientTx, senderWallet, recipientWallet)

      return {
        message: 'Transfert wallet-to-wallet effectué avec succès',
        data: { reference: senderTx.reference, status: 'success' },
      }
    } catch (error) {
      await trx.rollback()
      this.logger.error({ err: error }, 'Wallet-to-wallet transfer failed')
      throw error
    }
  }

  /**
   * Creates transactions and associated payment records for a wallet-to-wallet transfer.
   *
   * @param {TransferContext} context - The transfer context containing details of the sender, recipient, amount, fees, and other related information.
   * @param {BalanceSnapshot} balances - Snapshot of the sender's and recipient's wallet balances before and after the transactions.
   * @param {TransactionClientContract} trx - The database transaction client used to perform the operations atomically.
   * @return {Promise<[Transaction, Transaction]>} A promise that resolves to an array containing the sender's transaction and the recipient's transaction.
   */
  private async createTransactionsAndPayments(
    context: TransferContext,
    balances: BalanceSnapshot,
    trx: TransactionClientContract
  ): Promise<[Transaction, Transaction]> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = context

    // Transactions en parallèle
    const [senderTx, recipientTx] = await Promise.all([
      this.transactionService.createTransaction(
        {
          status: 'success',
          amount,
          direction: 'debit',
          total_amount: total,
          fees,
          balanceAfter: balances.senderAfter,
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Transfert to ${recipientWallet.user.firstname}${recipientWallet.user.lastname}`,
        },
        senderWallet.id,
        balances.senderBefore,
        currentUser,
        trx
      ),
      this.transactionService.createTransaction(
        {
          status: 'success',
          amount,
          direction: 'credit',
          total_amount: amount,
          fees: 0,
          balanceAfter: balances.recipientAfter,
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Received from ${senderWallet.user.firstname}${senderWallet.user.lastname}`,
        },
        recipientWallet.id,
        balances.recipientBefore,
        recipientWallet.user,
        trx
      ),
    ])

    // Paiements en parallèle
    await Promise.all([
      this.createPaymentRecord(
        senderTx,
        recipientWallet.user.phone,
        amount,
        total,
        fees,
        currentUser,
        trx
      ),
      this.createPaymentRecord(
        recipientTx,
        senderWallet.user.phone,
        amount,
        amount,
        0,
        currentUser,
        trx
      ),
    ])

    this.logger.info(
      { sender_tx_id: senderTx.id, recipient_tx_id: recipientTx.id, reference: senderTx.reference },
      'Transactions created for wallet-to-wallet'
    )

    return [senderTx, recipientTx]
  }

  /**
   * Creates a payment record by invoking the payment service with the specified details.
   *
   * @param {Transaction} transaction - The transaction object associated with the payment.
   * @param {string} phone - The phone number involved in the payment.
   * @param {number} amount - The amount being transferred in the payment.
   * @param {number} totalAmount - The total amount of the transaction, including fees.
   * @param {number} fees - The fees associated with the transaction.
   * @param {User} user - The user initiating the payment.
   * @param {TransactionClientContract} trx - The transaction client contract used for handling the database transaction.
   * @return {Promise<Payment>} A promise that resolves with the created payment record.
   */
  private createPaymentRecord(
    transaction: Transaction,
    phone: string,
    amount: number,
    totalAmount: number,
    fees: number,
    user: User,
    trx: TransactionClientContract
  ): Promise<Payment> {
    return this.paymentService.createPayment(
      {
        payment_method: 'internal',
        amount,
        total_amount: totalAmount,
        fees,
        payment_details: { operator: 'wallet', phone },
        status: 'success',
        step: 'wallet_to_wallet',
      },
      transaction,
      user,
      trx
    )
  }

  /**
   * Resolves the recipient of a transfer request based on the specified transfer mode.
   *
   * @param {TransferMode} mode - The mode of the transfer (e.g., 'by_qrcode', 'by_phone').
   * @param {WalletToWalletRequestDto} payload - The transfer request payload containing relevant details.
   * @param {string} senderUserId - The unique identifier of the sender.
   * @param {string} phoneCode - The phone code for validation when the transfer mode is 'by_phone'.
   * @return {Promise<Wallet>} A promise that resolves to the recipient's wallet information if the mode is supported.
   * @throws {Exception} Throws an exception if the mode is not supported.
   */
  private async resolveRecipient(
    mode: TransferMode,
    payload: WalletToWalletRequestDto,
    senderUserId: string,
    phoneCode: string
  ): Promise<Wallet> {
    switch (mode) {
      case 'by_qrcode':
        return this.walletService.getByWalletToken(payload.token)
      case 'by_phone':
        return this.walletService.getWalletByPhoneNumber(
          payload.recipient_phone,
          senderUserId,
          phoneCode
        )
      default:
        throw new Exception('Mode non supporté', { status: 400, code: 'MODE_UNSUPPORTED' })
    }
  }

  /**
   * Resolves the recipient's wallet information by their phone number.
   *
   * @param {string} phoneRaw - The raw phone number input provided by the user.
   * @param {string} senderUserId - The unique identifier of the sender initiating the transfer.
   * @param {string} countryPhone - The country code associated with the phone number.
   * @return {Promise<Wallet>} A promise that resolves to the recipient's wallet information.
   * @throws {Exception} If the phone number is not provided, invalid, not associated with an account, or matches the sender's account.
   */

  /**
   * Validates the sender and recipient wallets to ensure they exist and are not the same.
   *
   * @param {Wallet} senderWallet - The wallet of the sender.
   * @param {Wallet} recipientWallet - The wallet of the recipient.
   * @return {void} - Throws an error if validation fails.
   * @throws {Exception} If either the sender or recipient wallet is not found, or if both wallets are the same.
   */
  private validateWallets(senderWallet: Wallet, recipientWallet: Wallet): void {
    if (!senderWallet || !recipientWallet) {
      throw new Exception("Portefeuille de l'expéditeur ou du destinataire introuvable", {
        status: 404,
        code: 'WALLET_NOT_FOUND',
      })
    }

    if (senderWallet.id === recipientWallet.id) {
      this.logger.error(
        { sender_wallet_id: senderWallet.id, recipient_wallet_id: recipientWallet.id },
        'Sender and recipient wallets are the same'
      )
      throw new Exception('Impossible de transférer vers le même portefeuille', {
        status: 400,
        code: 'SAME_WALLET',
      })
    }
  }

  /**
   * Ensures that the user information for the provided sender and recipient wallets is loaded.
   * If the user data is not preloaded, it triggers the loading process for each wallet.
   *
   * @param {Wallet} sender - The wallet object associated with the sender.
   * @param {Wallet} recipient - The wallet object associated with the recipient.
   * @return {Promise<void>} A promise that resolves when the user information for both wallets is confirmed to be loaded.
   */
  private async ensureWalletsUsersLoaded(sender: Wallet, recipient: Wallet): Promise<void> {
    await Promise.all([
      sender.$preloaded.user ? Promise.resolve() : sender.load('user'),
      recipient.$preloaded.user ? Promise.resolve() : recipient.load('user'),
    ])
  }

  /**
   * Parses and validates the given raw amount.
   * Converts the input to a number and ensures it meets the criteria of a valid amount.
   * If the input is invalid, an exception is thrown.
   *
   * @param {unknown} amountRaw - The raw input to be parsed and validated as a numeric amount.
   * @return {number} The parsed and validated amount as a positive finite number.
   * @throws {Exception} If the input is not a valid positive number.
   */
  private parseAndValidateAmount(amountRaw: unknown): number {
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Exception('Montant invalide', { status: 400, code: 'INVALID_AMOUNT' })
    }
    return amount
  }

  /**
   * Dispatches a completion event for a wallet-to-wallet transaction, including details of the sender and recipient.
   * Handles errors during the event dispatch process by logging them.
   *
   * @param senderTx The transaction object for the sender.
   * @param recipientTx The transaction object for the recipient.
   * @param senderWallet The wallet object of the sender.
   * @param recipientWallet The wallet object of the recipient.
   * @return void
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
    }).catch((err) => this.logger.error({ err }, 'Failed to dispatch completion event'))
  }

  // Logging helpers
  private logTransferStart(
    user: User,
    mode: TransferMode,
    payload: WalletToWalletRequestDto
  ): void {
    this.logger.info(
      {
        user_id: user.id,
        mode,
        ...(mode === 'by_qrcode' && { qrcode: payload.token }),
        ...(mode === 'by_phone' && { recipient_phone: payload.recipient_phone }),
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

  private logRecipientPhoneMismatch(
    mode: TransferMode,
    providedPhone: string | undefined,
    recipientWallet: Wallet
  ): void {
    if (mode !== 'by_qrcode' || !providedPhone || !recipientWallet.user.phone) return

    const provided = normalizePhone(providedPhone)
    const actual = normalizePhone(recipientWallet.user.phone)

    if (provided && actual && provided !== actual) {
      this.logger.warn(
        {
          expected_phone: recipientWallet.user.phone,
          provided_phone: providedPhone,
          recipient_wallet_id: recipientWallet.id,
        },
        'Recipient phone mismatch between QR account and provided phone'
      )
    }
  }
}
