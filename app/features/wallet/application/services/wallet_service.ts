import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { toWalletCreatedResult } from '#features/wallet/application/mappers/wallet.mapper'
import { WalletCreatedResult } from '#features/wallet/application/dtos/wallet_created_result'
import Wallet from '#features/wallet/domain/models/wallet'
import { Exception } from '@adonisjs/core/exceptions'
import { randomUUID } from 'node:crypto'
import QrJwtService, { TOKEN_ERRORS } from '#features/qr/application/services/qr_jwt_service'
import { normalizePhone } from '#shared/utils/utiles'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { WalletStatus } from '#features/wallet/domain/enum/wallet_status'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import InvalidAmountException from '#features/wallet/infrastructure/exceptions/invalid_amount_exception'
import InsufficientFundsException from '#features/wallet/infrastructure/exceptions/insufficient_funds_exception'
import SelfTransferException from '#features/wallet/infrastructure/exceptions/self_transfer_exception'
import UnregisteredAccountException from '#features/user/infrastructure/exceptions/unregistered_account_exception'
import WalletStatusChanged from '#features/wallet/application/events/wallet_status_changed'

/**
 * Service for managing wallets, including creation, retrieval, and balance adjustments.
 */
@inject()
export default class WalletService {
  /**
   * Constructs an instance of the class.
   *
   * @param {WalletRepository} walletRepository - The repository used to interact with wallet data.
   * @param qrcodeJwtService
   * @param userRepository
   */
  constructor(
    private walletRepository: WalletRepository,
    private qrcodeJwtService: QrJwtService,
    private userRepository: UserRepository
  ) {}

  /**
   * Creates a wallet for the specified user if it doesn't already exist.
   * If a wallet already exists for the user, returns the existing wallet details.
   *
   * @param {string} userId - The parameters containing user details and wallet specifications.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<WalletCreatedResult>} A promise that resolves with the details of the created or existing wallet.
   */
  async createForUser(
    userId: string,
    trx?: TransactionClientContract
  ): Promise<WalletCreatedResult> {
    const existing = await this.walletRepository.findByUserId(userId)
    if (existing) return toWalletCreatedResult(existing)

    const walletCreated = await this.walletRepository.create(
      {
        userId,
        currencySymbol: 'XOF',
        balance: 0,
        qrcodeToken: randomUUID(),
      },
      trx
    )
    return toWalletCreatedResult(walletCreated)
  }

  /**
   * Retrieves a wallet associated with a specific user ID.
   *
   * @param {string} userId - The unique identifier of the user whose wallet is to be retrieved.
   * @return {Promise<Wallet>} A promise that resolves to the wallet associated with the given user ID.
   * @throws {Exception} If no wallet is found for the provided user ID, an exception is thrown with a status of 404 and code 'WALLET_NOT_FOUND'.
   */
  async getByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserId(userId)

    if (!wallet) {
      throw new WalletNotFoundException()
    }

    return wallet
  }

  /**
   * Credits the specified amount to the user's wallet balance.
   *
   * @param {number} walletId - The unique identifier of the wallet to be credited.
   * @param {number} amount - The amount to be credited to the wallet balance. Must be greater than zero.
   * @param {TransactionClientContract} [trx] - Optional transaction object used for database consistency.
   * @return {Promise<{id: number, balance: number} | null>} A promise that resolves to an object containing the wallet ID and updated balance if the operation is successful, or null if the update fails.
   */
  async creditBalance(
    walletId: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null> {
    if (amount <= 0) throw new InvalidAmountException()
    const updated = await this.walletRepository.creditGuarded(walletId, amount, trx)

    if (!updated) return null

    return { id: updated.id, balance: updated.balance ?? 0 }
  }

  /**
   * Deducts a specified amount from the wallet balance in a secure and guarded manner.
   *
   * @param {number} walletId - The unique identifier of the wallet to be debited.
   * @param {number} amount - The amount to debit from the wallet. Must be greater than zero.
   * @param {TransactionClientContract} [trx] - Optional transaction context for database operations.
   * @return {Promise<{ id: number, balance: number } | null>} An object containing the updated wallet id and balance if the operation is successful. Returns null if the transaction fails.
   * @throws {Exception} Throws an exception if the amount is invalid or if there are insufficient funds.
   */
  async debitBalance(
    walletId: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null> {
    if (amount <= 0) throw new InvalidAmountException()
    const updated = await this.walletRepository.debitGuarded(walletId, amount, trx)

    if (!updated) {
      throw new InsufficientFundsException()
    }

    return { id: updated.id, balance: updated.balance ?? 0 }
  }

  /**
   * Retrieves user account information associated with a wallet token.
   *
   * @param {string} token - The wallet token used to locate the user's wallet.
   * @return {Promise<{phone: string, token: string}>} A promise that resolves to an object containing the user's phone number and the wallet token.
   * @throws {Exception} If the wallet is not found, an exception is thrown with a status of 404 and the code 'WALLET_NOT_FOUND'.
   */
  async getByWalletToken(token?: string): Promise<Wallet> {
    if (!token?.length) {
      throw new Exception('Token requis pour le mode QR code', {
        status: 400,
        code: 'QRCODE_REQUIRED',
      })
    }

    const res = await this.qrcodeJwtService.verify(token)

    if (!res.ok) {
      const error = TOKEN_ERRORS[res.code] ?? { status: 422, message: res.code || 'Token invalide' }
      throw new Exception(error.message, {
        status: error.status,
        code: res.code || 'TOKEN_INVALID',
      })
    }

    return this.getByUserId(res.sub)
  }

  /**
   * Retrieves a wallet associated with a given phone number.
   * Validates the phone number, ensures the recipient exists, and checks that the sender is not transferring to themselves.
   *
   * @param {string} phoneRaw - The raw phone number provided by the sender.
   * @param {string} senderUserId - The unique identifier of the sender's user account.
   * @param {string} countryPhone - The country code to normalize the phone number.
   * @return {Promise<Wallet>} A promise that resolves to the wallet associated with the recipient's user account.
   * @throws {Exception} Throws an exception if the phone number is invalid, if no recipient exists, or if the sender is attempting to transfer to their own account.
   */
  async getWalletByPhoneNumber(
    phoneRaw: string,
    senderUserId: string,
    countryPhone: string
  ): Promise<Wallet> {
    const normalizedPhone = normalizePhone(phoneRaw, countryPhone)

    if (!normalizedPhone) {
      throw new Exception('Numéro de téléphone du destinataire requis', {
        status: 400,
        code: 'PHONE_REQUIRED',
      })
    }

    const recipientUser = await this.userRepository.findByPhone(normalizedPhone)

    if (!recipientUser) {
      throw new UnregisteredAccountException()
    }

    if (recipientUser.usersUid === senderUserId) {
      throw new SelfTransferException()
    }

    return this.getByUserId(recipientUser.usersUid)
  }

  /**
   * Updates the status of a user's wallet.
   *
   * @param {string} userId - The unique identifier of the user whose wallet status is to be updated.
   * @param {WalletStatus} status - The new status to be assigned to the user's wallet.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<Wallet>} A promise that resolves to the updated wallet instance.
   * @throws {Exception} If no wallet is found for the given user ID, an exception is thrown with status 404 and code 'WALLET_NOT_FOUND'.
   */
  async updateWalletStatus(
    userId: string,
    status: WalletStatus,
    trx?: TransactionClientContract
  ): Promise<Wallet> {
    const wallet = await this.getByUserId(userId)
    const updated = await this.walletRepository.updateStatus(wallet.id, status, trx)

    if (!updated) {
      throw new Exception('La mise à jour du portefeuille a échoué', {
        status: 500,
        code: 'E_WALLET_UPDATE_FAILED',
      })
    }

    await WalletStatusChanged.dispatch(userId, status)
    return updated
  }
}
