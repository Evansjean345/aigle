import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  WalletCreatedResult,
  toRecipientAccountResult,
  type RecipientAccountResult,
  type ResolveRecipientQuery,
} from '#core/money/wallet/application/dtos/wallet.dto'
import Wallet from '#core/money/wallet/domain/models/wallet'
import { Exception } from '@adonisjs/core/exceptions'
import { randomUUID } from 'node:crypto'
import QrJwtService, { TOKEN_ERRORS } from '#core/qr/application/services/qr_jwt_service'
import { normalizePhone } from '#shared/utils/utiles'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import { WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'
import WalletNotFoundException from '#core/money/wallet/domain/exceptions/wallet_not_found_exception'
import InvalidAmountException from '#core/money/wallet/domain/exceptions/invalid_amount_exception'
import InsufficientFundsException from '#core/money/wallet/domain/exceptions/insufficient_funds_exception'
import SelfTransferException from '#core/money/wallet/domain/exceptions/self_transfer_exception'
import UnregisteredAccountException from '#core/identity/user/domain/exceptions/unregistered_account_exception'
import WalletStatusChanged from '#core/money/wallet/application/events/wallet_status_changed'

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
   * @param walletId
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
   * Porte unique de résolution d'un bénéficiaire, en read-model wallet-core.
   *
   * Dispatche en interne selon la stratégie d'adressage (`by`) : token QR ou numéro de téléphone.
   * N'expose qu'un `RecipientAccountResult` ({ usersUid, phone }) — le modèle ORM `Wallet` ne sort
   * pas de wallet-core. Frontière à gros grain : un seul point d'entrée (un seul endpoint au split
   * micro-service) plutôt qu'une opération par stratégie.
   *
   * @throws {Exception} Selon la stratégie : token manquant/invalide, numéro invalide, destinataire
   *   inexistant, transfert vers soi-même, ou wallet introuvable (404).
   */
  async resolveRecipient(query: ResolveRecipientQuery): Promise<RecipientAccountResult> {
    const wallet =
      query.by === 'qrcode'
        ? await this.resolveWalletByToken(query.token)
        : await this.resolveWalletByPhone(query.phone, query.senderUsersUid, query.countryPhoneCode)

    await wallet.load('user')
    return toRecipientAccountResult(wallet)
  }

  /** Vérifie le token QR et charge le wallet du porteur. @private */
  private async resolveWalletByToken(token?: string): Promise<Wallet> {
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
   * Normalise le numéro, vérifie l'existence du destinataire et l'absence de transfert vers
   * soi-même, puis charge le wallet du destinataire. @private
   */
  private async resolveWalletByPhone(
    phoneRaw: string,
    senderUsersUid: string,
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

    if (recipientUser.usersUid === senderUsersUid) {
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
