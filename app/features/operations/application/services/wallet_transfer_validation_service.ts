import { inject } from '@adonisjs/core'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import Wallet from '#features/wallet/domain/models/wallet'
import User from '#features/users/domain/models/user'
import {
  TransferContext,
  TransferMode,
} from '#features/operations/application/services/wallet_transfer_context_service'
import { normalizePhone } from '#shared/utils/utiles'
import logger from '@adonisjs/core/services/logger'
import WalletNotFoundException from '#features/operations/infrastructure/exceptions/wallet_not_found_exception'
import SameWalletTransferException from '#features/operations/infrastructure/exceptions/same_wallet_transfer_exception'

@inject()
export default class WalletTransferValidationService {
  private readonly logger = logger.use('transaction')

  /**
   * Creates a new instance of the class.
   *
   * @param {AccountValidationService} accountValidationService - Service used to validate account details.
   * @param {TransactionLimitValidationService} transactionLimitValidationService - Service used to validate transaction limits.
   */
  constructor(
    private readonly accountValidationService: AccountValidationService,
    private readonly transactionLimitValidationService: TransactionLimitValidationService
  ) {}

  /**
   * Validates the transfer context and ensures the provided parameters meet the necessary conditions for the transfer.
   *
   * @param {TransferContext} context - The transfer context containing details such as sender and recipient wallets, amount, and current user.
   * @param {TransferMode} mode - The mode of the transfer, specifying how the transfer should be processed.
   * @param {string} [providedPhone] - An optional phone number to verify against the recipient's phone number.
   * @return {Promise<void>} A promise that resolves when the validation is complete or throws an error if validation fails.
   */
  async validate(
    context: TransferContext,
    mode: TransferMode,
    providedPhone?: string
  ): Promise<void> {
    const { senderWallet, recipientWallet, amount, total, currentUser } = context

    this.validateWallets(senderWallet, recipientWallet)
    await this.ensureWalletsUsersLoaded(senderWallet, recipientWallet)

    this.logRecipientPhoneMismatch(mode, providedPhone, recipientWallet)

    await this.validateUserForTransfer(currentUser, total, TransactionDirection.DEBIT)
    await this.validateUserForTransfer(
      recipientWallet.user,
      amount,
      TransactionDirection.CREDIT,
      true
    )
  }

  /**
   * Validates the sender and recipient wallets to ensure they exist and are not the same.
   *
   * @param {Wallet} senderWallet - The wallet associated with the sender of the transaction.
   * @param {Wallet} recipientWallet - The wallet associated with the recipient of the transaction.
   * @return {void}
   * @throws {WalletNotFoundException} If either wallet is not found (HTTP 404, code: WALLET_NOT_FOUND)
   *                     or if the sender and recipient wallets are the same (HTTP 400, code: SAME_WALLET).
   */
  private validateWallets(senderWallet: Wallet, recipientWallet: Wallet): void {
    if (!senderWallet || !recipientWallet) {
      throw new WalletNotFoundException(
        "Portefeuille de l'expéditeur ou du destinataire introuvable"
      )
    }

    if (senderWallet.id === recipientWallet.id) {
      this.logger.error(
        {
          sender_wallet_id: senderWallet.id,
          recipient_wallet_id: recipientWallet.id,
          status: 400,
          code: 'SAME_WALLET',
        },
        'Impossible de transférer vers le même portefeuille'
      )
      throw new SameWalletTransferException()
    }
  }

  /**
   * Ensures that the user relationships for the sender and recipient wallets are loaded in memory.
   *
   * @param {Wallet} sender - The wallet object representing the sender. If the user relationship is not preloaded, it will be loaded.
   * @param {Wallet} recipient - The wallet object representing the recipient. If the user relationship is not preloaded, it will be loaded.
   * @return {Promise<void>} A promise that resolves once the user relationships for both wallets are ensured as loaded.
   */
  private async ensureWalletsUsersLoaded(sender: Wallet, recipient: Wallet): Promise<void> {
    await Promise.all([
      sender.$preloaded.user ? Promise.resolve() : sender.load('user'),
      recipient.$preloaded.user ? Promise.resolve() : recipient.load('user'),
    ])
  }

  /**
   * Validates whether a user is eligible to perform a transfer by verifying their account
   * and ensuring the transaction complies with defined limits.
   *
   * @param {User} user - The user initiating the transfer.
   * @param {number} amount - The amount to be transferred.
   * @param {TransactionDirection} direction - The direction of the transfer (e.g., incoming or outgoing).
   * @param {boolean} isRecipient - Whether the user being validated is the recipient.
   * @return {Promise<void>} - A promise that resolves when validation is complete.
   */
  private async validateUserForTransfer(
    user: User,
    amount: number,
    direction: TransactionDirection,
    isRecipient: boolean = false
  ): Promise<void> {
    await this.accountValidationService.validateAccount(user, isRecipient)
    await this.transactionLimitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction,
    })
  }

  /**
   * Logs a warning when a mismatch is identified between the phone number
   * provided and the phone number associated with the recipient's wallet.
   *
   * @param mode The mode of operation, which determines if validation is needed (e.g., "by_qrcode").
   * @param providedPhone The phone number provided for the recipient, which may be undefined.
   * @param recipientWallet The recipient's wallet object containing user information, including the phone number.
   * @return void
   */
  private logRecipientPhoneMismatch(
    mode: TransferMode,
    providedPhone: string | undefined,
    recipientWallet: Wallet
  ): void {
    if (mode !== TransferMode.BY_QRCODE || !providedPhone || !recipientWallet.user.phone) return

    const provided = normalizePhone(providedPhone)
    const actual = normalizePhone(recipientWallet.user.phone)

    if (provided && actual && provided !== actual) {
      this.logger.warn(
        {
          expected_phone: recipientWallet.user.phone,
          provided_phone: providedPhone,
          recipient_wallet_id: recipientWallet.id,
        },
        'Discordance du numéro de téléphone entre le compte destinataire et celui fourni'
      )
    }
  }
}
