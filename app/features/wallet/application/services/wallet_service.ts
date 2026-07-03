import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  WalletCreatedResult,
  toRecipientAccountResult,
  type RecipientAccountResult,
} from '#features/wallet/application/dtos/wallet.dto'
import Wallet from '#features/wallet/domain/models/wallet'
import { Exception } from '@adonisjs/core/exceptions'
import { randomUUID } from 'node:crypto'
import QrJwtService, { TOKEN_ERRORS } from '#features/qr/application/services/qr_jwt_service'
import { normalizePhone } from '#shared/utils/utiles'
import UserRepository from '#features/user/domain/interfaces/user_repository'
import { WalletStatus } from '#features/wallet/domain/enums/wallet_status'
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
    if (existing) return WalletCreatedResult.fromWallet(existing)

    const walletCreated = await this.walletRepository.create(
      {
        userId,
        currencySymbol: 'XOF',
        balance: 0,
        qrcodeToken: randomUUID(),
      },
      trx
    )
    return WalletCreatedResult.fromWallet(walletCreated)
  }

  /**
   * Retrieves a wallet associated with a specific user ID.
   *
   * @param {string} userId - The unique identifier of the user whose wallet is to be retrieved.
   * @param trx - Optional transaction client for database operations.
   * @return {Promise<Wallet>} A promise that resolves to the wallet associated with the given user ID.
   * @throws {Exception} If no wallet is found for the provided user ID, an exception is thrown with a status of 404 and code 'WALLET_NOT_FOUND'.
   */
  async getWalletById(walletId: number, trx?: TransactionClientContract): Promise<Wallet> {
    const wallet = await this.walletRepository.findById(walletId, trx)

    if (!wallet) {
      throw new WalletNotFoundException()
    }

    return wallet
  }

  async getByUserId(userId: string, trx?: TransactionClientContract): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserId(userId, trx)

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
   * @return {Promise<{ id: number, balance: number }>} An object containing the updated wallet id and balance if the operation is successful. Returns null if the transaction fails.
   * @throws {Exception} Throws an exception if the amount is invalid or if there are insufficient funds.
   */
  async debitBalance(
    walletId: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number }> {
    if (amount <= 0) throw new InvalidAmountException()
    const updated = await this.walletRepository.debitGuarded(walletId, amount, trx)

    if (!updated) {
      throw new InsufficientFundsException()
    }

    return { id: updated.id, balance: updated.balance ?? 0 }
  }

  /**
   * Résout le compte bénéficiaire désigné par un token QR, en read-model wallet-core.
   *
   * Vérifie le token, charge le wallet + son porteur, et n'expose que `RecipientAccountResult`
   * ({ usersUid, phone }) : le modèle ORM `Wallet` ne sort pas de wallet-core.
   *
   * @param {string} token - Le token QR encodant le porteur du wallet.
   * @return {Promise<RecipientAccountResult>} Le compte bénéficiaire résolu.
   * @throws {Exception} Token manquant/invalide, ou wallet introuvable (404).
   */
  async resolveRecipientByToken(token?: string): Promise<RecipientAccountResult> {
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

    const wallet = await this.getByUserId(res.sub)
    await wallet.load('user')
    return toRecipientAccountResult(wallet)
  }

  /**
   * Résout le compte bénéficiaire désigné par un numéro de téléphone, en read-model wallet-core.
   *
   * Normalise le numéro, vérifie que le destinataire existe et que l'émetteur ne se transfère pas
   * à lui-même, puis n'expose que `RecipientAccountResult` ({ usersUid, phone }) : le modèle ORM `Wallet`
   * ne sort pas de wallet-core.
   *
   * @param {string} phoneRaw - Le numéro fourni par l'émetteur.
   * @param {string} senderUserId - L'UID du compte émetteur.
   * @param {string} countryPhone - L'indicatif pays pour la normalisation.
   * @return {Promise<RecipientAccountResult>} Le compte bénéficiaire résolu.
   * @throws {Exception} Numéro invalide, destinataire inexistant, ou transfert vers soi-même.
   */
  async resolveRecipientByPhone(
    phoneRaw: string,
    senderUserId: string,
    countryPhone: string
  ): Promise<RecipientAccountResult> {
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

    const wallet = await this.getByUserId(recipientUser.usersUid)
    await wallet.load('user')
    return toRecipientAccountResult(wallet)
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
