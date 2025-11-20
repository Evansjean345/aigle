import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import User from '#features/users/domain/models/user'
import { Exception } from '@adonisjs/core/exceptions'
import Transaction, { TransactionType } from '#features/transactions/domain/models/transaction'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDto,
} from '#features/operations/application/dto/wallet_to_wallet.dto'
import { Logger } from '@adonisjs/core/logger'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import { normalizePhone } from '#shared/utils/utiles'
import UserRepository from '#features/users/domain/interfaces/user_repository'
import Wallet from '#features/wallet/domain/models/wallet'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import QrJwtService from '#features/qr/application/services/qr_jwt_service'

/**
 * Class responsible for handling wallet-to-wallet transfers.
 * This use case facilitates money transfers between wallets, either using a QR code or a phone number.
 */
@inject()
export default class WalletToWalletUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {WalletService} walletService - Service responsible for handling wallet-related operations.
   * @param {TransactionService} transactionService - Service responsible for managing transactions.
   * @param {PaymentService} paymentService - Service responsible for payment processing.
   * @param {UserRepository} userRepository - Repository for managing user data.
   * @param {CountryRepository} countryRepository - Repository for accessing country-related data.
   * @param {QrJwtService} qrcodeJwtService - Service for generating and validating QR code-based JWT tokens.
   * @param {Logger} logger - Logging utility for tracking and recording application events.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly userRepository: UserRepository,
    private readonly countryRepository: CountryRepository,
    private readonly qrcodeJwtService: QrJwtService,
    private readonly logger: Logger
  ) {}

  /**
   * Executes a wallet-to-wallet transfer operation.
   *
   * @param {WalletToWalletRequestDto} payload - The request payload containing transfer details such as recipient and amount.
   * @param {User} currentUser - The user who is initiating the transfer.
   * @param {'by_qrcode' | 'by_phone'} mode - The mode of transfer, either by scanning QR code or using recipient's phone number.
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves to the response containing details of the transfer operation.
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: 'by_qrcode' | 'by_phone'
  ): Promise<WalletToWalletResponseDto> {
    this.logger.info(
      {
        user_id: currentUser.id,
        mode,
        qrcode: mode === 'by_qrcode' && payload.token,
        recipient_phone: mode === 'by_phone' && payload.recipient_phone,
        amount: payload.amount,
      },
      'Starting wallet-to-wallet transfer'
    )

    // Parallel data fetching for better performance
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

    this.validateTransfer(senderWallet, recipientWallet)

    // Preload users in parallel
    await Promise.all([senderWallet.load('user'), recipientWallet.load('user')])

    this.logRecipientPhoneMismatch(
      mode,
      payload.recipient_phone,
      recipientWallet.user.phone,
      recipientWallet.id
    )

    const amount = this.validateAmount(payload.amount)
    const fees = 0
    const total = amount + fees

    return await this.executeTransfer({
      senderWallet,
      recipientWallet,
      amount,
      fees,
      total,
      currentUser,
    })
  }

  /**
   * Resolves the recipient based on the specified mode and payload.
   *
   * @param {'by_qrcode' | 'by_phone'} mode The method to resolve the recipient, either via QR code or phone number.
   * @param {WalletToWalletRequestDto} payload The request payload containing recipient details.
   * @param {string} senderUserId The ID of the user who is sending the request.
   * @param {string} phoneCode The phone code of the recipient when resolving by phone.
   * @return {Promise<Wallet>} A Promise that resolves to the recipient's Wallet object.
   * @throws {Exception} Throws an exception if the mode is unsupported.
   */
  private async resolveRecipient(
    mode: 'by_qrcode' | 'by_phone',
    payload: WalletToWalletRequestDto,
    senderUserId: string,
    phoneCode: string
  ): Promise<Wallet> {
    if (mode === 'by_qrcode') {
      return this.resolveRecipientByToken(payload.token)
    }

    if (mode === 'by_phone') {
      return this.resolveRecipientByPhone(payload.recipient_phone, senderUserId, phoneCode)
    }

    throw new Exception('Unsupported mode', { status: 400, code: 'MODE_UNSUPPORTED' })
  }

  /**
   * Validates if the transfer between the sender and recipient wallets can proceed.
   *
   * @param {Wallet} senderWallet - The wallet from which funds are being transferred.
   * @param {Wallet} recipientWallet - The wallet to which funds are being transferred.
   * @throws {Exception} Throws an exception if the sender or recipient wallet is not found, or if the sender and recipient wallets are the same.
   * @return {void}
   */
  private validateTransfer(senderWallet: Wallet, recipientWallet: Wallet): void {
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
        'Sender and recipient wallets are the same, aborting transfer'
      )
      throw new Exception('Cannot transfer to the same wallet', {
        status: 400,
        code: 'SAME_WALLET',
      })
    }
  }

  /**
   * Executes a wallet-to-wallet transfer, updating balances and creating payment records.
   *
   * @param {Object} params - The parameters required for the transfer.
   * @param {Wallet} params.senderWallet - The wallet of the sender.
   * @param {Wallet} params.recipientWallet - The wallet of the recipient.
   * @param {number} params.amount - The amount to be transferred.
   * @param {number} params.fees - The fees for the transaction.
   * @param {number} params.total - The total amount to be debited from the sender's wallet (amount + fees).
   * @param {User} params.currentUser - The current user initiating the transaction.
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves with the response object containing details of the transfer.
   */
  private async executeTransfer(params: {
    senderWallet: Wallet
    recipientWallet: Wallet
    amount: number
    fees: number
    total: number
    currentUser: User
  }): Promise<WalletToWalletResponseDto> {
    const { senderWallet, recipientWallet, amount, fees, total, currentUser } = params

    const senderBalanceBefore = senderWallet.balance
    const recipientBalanceBefore = recipientWallet.balance

    const trx = await db.transaction()

    try {
      // Update balances in parallel
      const [senderAfter, recipientAfter] = await Promise.all([
        this.walletService.debitBalance(senderWallet.id, total, trx),
        this.walletService.creditBalance(recipientWallet.id, amount, trx),
      ])

      if (!senderAfter || !recipientAfter) {
        throw new Exception('Failed to update wallet balances', { status: 500 })
      }

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

      // Create transactions
      const [senderTx, recipientTx] = await this.createTransactionPair({
        senderWallet,
        recipientWallet,
        amount,
        fees,
        total,
        senderAfter,
        recipientAfter,
        senderBalanceBefore,
        recipientBalanceBefore,
        currentUser,
        trx,
      })

      // Create payment records in parallel
      await Promise.all([
        this.paymentService.createPayment(
          {
            payment_method: 'internal',
            amount,
            total_amount: total,
            fees,
            payment_details: {
              operator: 'wallet',
              phone: recipientWallet.user.phone,
            },
            status: 'success',
            step: 'wallet_to_wallet',
          },
          senderTx,
          currentUser,
          trx
        ),
        this.paymentService.createPayment(
          {
            payment_method: 'internal',
            amount,
            total_amount: amount,
            fees: 0,
            payment_details: {
              operator: 'wallet',
              phone: senderWallet.user.phone,
            },
            status: 'success',
            step: 'wallet_to_wallet',
          },
          recipientTx,
          currentUser,
          trx
        ),
      ])

      this.logger.info(
        { reference: senderTx.reference, status: 'success' },
        'Wallet-to-wallet transfer completed'
      )

      await trx.commit()

      // Fire event asynchronously (don't await)
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

  /**
   * Creates a pair of transactions for a wallet-to-wallet transfer.
   *
   * @param {Object} params - The parameters for the transaction pair creation.
   * @param {Wallet} params.senderWallet - The wallet of the sender.
   * @param {Wallet} params.recipientWallet - The wallet of the recipient.
   * @param {number} params.amount - The amount to be transferred.
   * @param {number} params.fees - The fees associated with the transaction.
   * @param {number} params.total - The total amount charged from the sender's wallet (amount + fees).
   * @param {Object} params.senderAfter - The sender's wallet state after the transaction.
   * @param {string} params.senderAfter.id - The ID of the sender's wallet.
   * @param {number} params.senderAfter.balance - The balance of the sender's wallet after the transaction.
   * @param {Object} params.recipientAfter - The recipient's wallet state after the transaction.
   * @param {string} params.recipientAfter.id - The ID of the recipient's wallet.
   * @param {number} params.recipientAfter.balance - The balance of the recipient's wallet after the transaction.
   * @param {number} params.senderBalanceBefore - The sender's wallet balance before the transaction.
   * @param {number} params.recipientBalanceBefore - The recipient's wallet balance before the transaction.
   * @param {User} params.currentUser - The user initiating the transaction.
   * @param {any} params.trx - The database transaction object.
   * @return {Promise<[Transaction, Transaction]>} - A promise that resolves to an array containing the sender and recipient transactions.
   */
  private async createTransactionPair(params: {
    senderWallet: Wallet
    recipientWallet: Wallet
    amount: number
    fees: number
    total: number
    senderAfter: Pick<Wallet, 'id' | 'balance'>
    recipientAfter: Pick<Wallet, 'id' | 'balance'>
    senderBalanceBefore: number
    recipientBalanceBefore: number
    currentUser: User
    trx: any
  }): Promise<[Transaction, Transaction]> {
    const {
      senderWallet,
      recipientWallet,
      amount,
      fees,
      total,
      senderAfter,
      recipientAfter,
      senderBalanceBefore,
      recipientBalanceBefore,
      currentUser,
      trx,
    } = params

    const [senderTx, recipientTx] = await Promise.all([
      this.transactionService.createTransaction(
        {
          status: 'success',
          amount,
          direction: 'debit',
          total_amount: total,
          fees,
          balanceAfter: senderAfter.balance,
          operation_type: 'wallet_transfert' as TransactionType,
          description: 'Wallet to Wallet transfer',
        },
        senderWallet.id,
        senderBalanceBefore,
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
          operation_type: 'wallet_transfert' as TransactionType,
          description: `Received from ${senderWallet.user.firstname}`,
          balanceAfter: recipientAfter.balance,
        },
        recipientWallet.id,
        recipientBalanceBefore,
        recipientWallet.user,
        trx
      ),
    ])

    this.logger.info(
      {
        sender_tx_id: senderTx.id,
        recipient_tx_id: recipientTx.id,
        reference: senderTx.reference,
      },
      'Transactions created for wallet-to-wallet'
    )

    return [senderTx, recipientTx]
  }

  /**
   * Resolves a recipient wallet using a provided token by verifying it via the QR code service.
   *
   * @param {string} [token] - The token to be verified and used for resolving the recipient.
   *                           This token is required for by_qrcode mode.
   * @return {Promise<Wallet>} A promise that resolves to a wallet associated with the resolved recipient.
   * @throws {Exception} If the token is missing, invalid, expired, already used, or any other verification issue occurs.
   */
  private async resolveRecipientByToken(token?: string): Promise<Wallet> {
    if (!token?.length) {
      throw new Exception('token is required for by_qrcode mode', {
        status: 400,
        code: 'QRCODE_REQUIRED',
      })
    }

    const res = await this.qrcodeJwtService.verify(token)

    if (!res.ok) {
      const errorMap: Record<string, { status: number; message: string }> = {
        TOKEN_EXPIRED: { status: 410, message: 'Le token a expiré' },
        TOKEN_REPLAY: { status: 409, message: 'Ce token a déjà été utilisé' },
      }

      const error = errorMap[res.code] || { status: 422, message: res.code || 'Token invalide' }

      throw new Exception(error.message, {
        status: error.status,
        code: res.code || 'TOKEN_INVALID',
      })
    }

    return this.walletService.getByUserId(res.sub)
  }

  /**
   * Resolves the recipient's wallet based on their phone number.
   *
   * @param {string} phoneRaw - The raw phone number of the recipient.
   * @param {string} senderUserId - The user ID of the sender initiating the transaction.
   * @param {string} countryPhone - The country code for the phone number.
   * @return {Promise<Wallet>} A promise that resolves to the recipient's wallet object.
   * @throws {Exception} Throws an exception if the phone number is invalid, not linked to an account, or pertains to the sender.
   */
  private async resolveRecipientByPhone(
    phoneRaw: string,
    senderUserId: string,
    countryPhone: string
  ): Promise<Wallet> {
    const normalizedPhone = normalizePhone(phoneRaw, countryPhone)

    if (!normalizedPhone) {
      throw new Exception('recipient_phone is required for by_phone mode', {
        status: 400,
        code: 'PHONE_REQUIRED',
      })
    }

    const recipientUser = await this.userRepository.findByPhone(normalizedPhone)

    if (!recipientUser) {
      throw new Exception("Ce numéro n'est pas un compte Aigle send", {
        status: 400,
        code: 'UNREGISTERED_ACCOUNT',
      })
    }

    if (recipientUser.usersUid === senderUserId) {
      throw new Exception('Transfert vers soi-même interdit', {
        status: 400,
        code: 'SELF_TRANSFER',
      })
    }

    return this.walletService.getByUserId(recipientUser.usersUid)
  }

  /**
   * Validates and converts the input amount to a number. Ensures the amount is a positive, finite number.
   *
   * @param {any} amountRaw - The raw input representing the amount to validate and convert.
   * @return {number} The validated and processed amount as a number.
   * @throws {Exception} If the input amount is not finite or is less than or equal to zero.
   */
  private validateAmount(amountRaw: any): number {
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Exception('Montant invalide', { status: 400, code: 'INVALID_AMOUNT' })
    }
    return amount
  }

  /**
   * Logs a warning if the recipient's phone number does not match the provided one.'
   *
   * @param mode
   * @param providedPhone
   * @param actualPhone
   * @param recipientWalletId
   * @private
   */
  private logRecipientPhoneMismatch(
    mode: 'by_qrcode' | 'by_phone',
    providedPhone: string | undefined,
    actualPhone: string | undefined,
    recipientWalletId: number
  ): void {
    if (mode !== 'by_qrcode' || !providedPhone || !actualPhone) return

    const provided = normalizePhone(providedPhone)
    const actual = normalizePhone(actualPhone)

    if (provided && actual && provided !== actual) {
      this.logger.warn(
        {
          expected_phone: actualPhone,
          provided_phone: providedPhone,
          recipient_wallet_id: recipientWalletId,
        },
        'Recipient phone mismatch between QR account and provided phone'
      )
    }
  }
}
