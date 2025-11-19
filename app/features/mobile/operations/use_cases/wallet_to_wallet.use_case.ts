import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import WalletService from '#mobile/wallet/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import User from '#features/authentication/domain/models/user'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionType } from '#features/transactions/domain/models/transaction'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDto,
} from '#mobile/operations/dto/wallet_to_wallet.dto'
import { Logger } from '@adonisjs/core/logger'
import WalletToWalletTransactionCompleted from '#mobile/operations/events/wallet_to_wallet_transaction_completed'
import { normalizePhone } from '#shared/kernel/utils/utiles'
import UserRepository from '#features/authentication/domain/interfaces/user_repository'
import Wallet from '#features/wallet/domain/models/wallet'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import QrJwtService from '#mobile/qr/services/qr_jwt_service'

/**
 * Use case class responsible for handling wallet-to-wallet transfer operations.
 */
@inject()
export default class WalletToWalletUseCase {
  /**
   * Constructs an instance of the class and initializes required services and dependencies.
   *
   * @param {WalletService} walletService - Service to manage wallet-related operations.
   * @param {TransactionService} transactionService - Service to handle transaction functionality.
   * @param {PaymentService} paymentService - Service to process and manage payments.
   * @param {UserRepository} userRepository - Repository for accessing and managing user data.
   * @param countryRepository
   * @param qrcodeJwtService
   * @param {Logger} logger - Utility for logging information and errors.
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
   * Executes a wallet-to-wallet transfer based on the provided mode.
   *
   * @param {WalletToWalletRequestDto} payload - The details of the transfer request including amount and recipient details.
   * @param {User} currentUser - The currently authenticated user initiating the transfer.
   * @param {'by_qrcode' | 'by_phone'} mode - The method of identifying the recipient ('by_qrcode' or 'by_phone').
   * @return {Promise<WalletToWalletResponseDto>} A promise that resolves to the response containing the status and reference of the transaction.
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

    // Resolve sender wallet from current user
    const senderWallet = await this.walletService.getByUserId(currentUser.usersUid!)
    const senderCountry = await this.countryRepository.findCountryBy('id', currentUser.countryId)

    let recipientWallet

    switch (mode) {
      case 'by_qrcode':
        recipientWallet = await this.resolveRecipientByToken(payload.token)
        break
      case 'by_phone':
        recipientWallet = await this.resolveRecipientByPhone(
          payload.recipient_phone,
          currentUser.usersUid!,
          senderCountry.phoneCode
        )
        break
      default:
        throw new Exception('Unsupported mode', { status: 400, code: 'MODE_UNSUPPORTED' })
    }

    this.ensureWalletsPresent(senderWallet, recipientWallet)
    this.ensureDifferentWallets(senderWallet.id, recipientWallet.id)

    await senderWallet.load('user')
    await recipientWallet.load('user')

    this.logRecipientPhoneMismatch(
      mode,
      payload.recipient_phone,
      recipientWallet.user.phone,
      recipientWallet.id
    )

    const amount = this.validateAmount(payload.amount)
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
            phone: recipientWallet.user.phone,
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
            phone: senderWallet.user.phone,
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

  /**
   *
   * @param token
   * @private
   */
  private async resolveRecipientByToken(token?: string): Promise<Wallet> {
    if (!token || token.length === 0) {
      throw new Exception('token is required for by_qrcode mode', {
        status: 400,
        code: 'QRCODE_REQUIRED',
      })
    }

    const res = await this.qrcodeJwtService.verify(token)
    console.log(res)

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

    return await this.walletService.getByUserId(res.sub)
  }

  /**
   * Resolves a recipient's wallet information by their phone number.
   *
   * @param {string} phoneRaw - The raw phone number provided by the sender.
   * @param {string} senderUserId - The unique identifier of the sender user.
   * @param {string} countryPhone - The country code associated with the phone number.
   * @return {Promise<Wallet>} A promise resolving to the recipient's wallet information.
   * @throws {Exception} If the phone number is invalid or missing.
   * @throws {Exception} If the recipient user is not registered with the service.
   * @throws {Exception} If the sender attempts to transfer to their own account.
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

    return await this.walletService.getByUserId(recipientUser.usersUid)
  }

  /**
   * Ensures that both the sender and recipient wallets are present.
   * Throws an exception if either is missing.
   *
   * @param {any} sender - The wallet of the sender.
   * @param {any} recipient - The wallet of the recipient.
   * @return {void} This method does not return a value.
   */
  private ensureWalletsPresent(sender: any, recipient: any): void {
    if (!sender || !recipient) {
      throw new Exception('Sender or recipient wallet not found', {
        status: 404,
        code: 'WALLET_NOT_FOUND',
      })
    }
  }

  /**
   * Ensures that the sender's wallet ID and the recipient's wallet ID are different.
   * Throws an exception if both wallet IDs are the same.
   *
   * @param {number} senderWalletId - The unique ID of the sender's wallet.
   * @param {number} recipientWalletId - The unique ID of the recipient's wallet.
   * @return {void} Throws an exception if the sender and recipient wallet IDs are identical.
   */
  private ensureDifferentWallets(senderWalletId: number, recipientWalletId: number): void {
    if (senderWalletId === recipientWalletId) {
      this.logger.error(
        {
          sender_wallet_id: senderWalletId,
          recipient_wallet_id: recipientWalletId,
        },
        'Sender and recipient wallets are the same, aborting  transfer'
      )
      throw new Exception('Cannot transfer to the same wallet', {
        status: 400,
        code: 'SAME_WALLET',
      })
    }
  }

  /**
   * Validates and converts a given raw amount input into a number.
   * Throws an exception if the amount is invalid or not a positive number.
   *
   * @param {any} amountRaw - The raw input representing the amount.
   * @return {number} - The validated and converted amount as a number.
   */
  private validateAmount(amountRaw: any): number {
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Exception('Montant invalide', { status: 400, code: 'INVALID_AMOUNT' })
    }
    return amount
  }

  /**
   * Logs a warning when there is a mismatch between the phone number provided and the actual phone number
   * associated with a recipient wallet, based on the mode of recipient identification.
   *
   * @param {'by_qrcode' | 'by_phone'} mode - The mode used to identify the recipient, either 'by_qrcode' or 'by_phone'.
   * @param {string | undefined} providedPhone - The phone number provided during the identification process.
   * @param {string | undefined} actualPhone - The phone number actually associated with the recipient's wallet.
   * @param {number} recipientWalletId - The unique identifier of the recipient's wallet.
   * @return {void} This method does not return a value.
   */
  private logRecipientPhoneMismatch(
    mode: 'by_qrcode' | 'by_phone',
    providedPhone: string | undefined,
    actualPhone: string | undefined,
    recipientWalletId: number
  ): void {
    const provided = normalizePhone(providedPhone)
    const actual = normalizePhone(actualPhone)

    if (mode === 'by_qrcode' && provided && actual && provided !== actual) {
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
