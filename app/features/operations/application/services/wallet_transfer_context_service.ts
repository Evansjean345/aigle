import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import Wallet from '#features/wallet/domain/models/wallet'
import WalletService from '#features/wallet/application/services/wallet_service'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { WalletToWalletRequestDto } from '#features/operations/application/dtos/operation.dto'
import ModeUnsupportedException from '#features/operations/infrastructure/exceptions/mode_unsupported_exception'
import InvalidAmountException from '#features/operations/infrastructure/exceptions/invalid_amount_exception'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'

export enum TransferMode {
  BY_QRCODE = 'by_qrcode',
  BY_PHONE = 'by_phone',
}

export interface TransferContext {
  senderWallet: Wallet
  recipientWallet: Wallet
  amount: number
  currentUser: User
  /**
   * Codes métier du contexte de frais (service transfert / moyen wallet / provider aigle),
   * passés tels quels à l'engine qui les résout via CatalogResolver (ADR-0013). Le produit ne
   * lit plus le catalogue et ne pré-calcule plus les frais : l'engine est autosuffisant.
   */
  feeContext: {
    serviceTypeCode: string
    paymentMethodCode: string
    providerFromCode: string
  }
}

/**
 * Service responsible for creating transfer contexts for wallet-to-wallet transfers.
 */
@inject()
export default class WalletTransferContextService {
  /**
   * Constructs an instance of the class.
   *
   * @param {WalletService} walletService - The service responsible for wallet-related operations.
   * @param {CountryRepository} countryRepository - The repository for accessing country data.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly countryRepository: CountryRepository
  ) {}

  /**
   * Creates a transfer context for a wallet-to-wallet transaction.
   *
   * @param {WalletToWalletRequestDto} payload - The data required to perform the wallet-to-wallet transfer, such as recipient details and amount.
   * @param {User} currentUser - The user initiating the transfer.
   * @param {TransferMode} mode - The mode of transfer, which defines how the recipient is resolved.
   * @return {Promise<TransferContext>} A promise that resolves with the transfer context, containing details about the sender and recipient wallets, amount, fees, and total transfer information.
   */
  async create(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode
  ): Promise<TransferContext> {
    const [senderWallet, senderCountry] = await Promise.all([
      this.walletService.getByUserId(currentUser.usersUid!).then(async (w) => {
        await w.load('user')
        return w
      }),
      this.countryRepository.findCountryBy('id', currentUser.countryId),
    ])

    const recipientWallet = await this.resolveRecipient(
      mode,
      payload,
      currentUser.usersUid!,
      senderCountry.phoneCode
    )

    await recipientWallet.load('user')
    const amount = this.parseAndValidateAmount(payload.amount)

    return {
      senderWallet,
      recipientWallet,
      amount,
      currentUser,
      // Codes constants du transfert wallet-to-wallet ; l'engine résout et calcule les frais.
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: PaymentMethod.WALLET,
        providerFromCode: 'aigle',
      },
    }
  }

  /**
   * Resolves the recipient wallet based on the specified transfer mode.
   * - If the mode is 'by_qrcode', the recipient wallet is resolved using the provided token.
   * - If the mode is 'by_phone', the recipient wallet is resolved using the provided phone number and the user ID of the sender.
   *
   * @param mode
   * @param payload
   * @param senderUserId
   * @param phoneCode
   * @private
   */
  private async resolveRecipient(
    mode: TransferMode,
    payload: WalletToWalletRequestDto,
    senderUserId: string,
    phoneCode: string
  ): Promise<Wallet> {
    switch (mode) {
      case TransferMode.BY_QRCODE:
        return this.walletService.getByWalletToken(payload.token)
      case TransferMode.BY_PHONE:
        return this.walletService.getWalletByPhoneNumber(
          payload.recipientPhone!,
          senderUserId,
          phoneCode
        )
      default:
        throw new ModeUnsupportedException()
    }
  }

  /**
   * Parses and validates a raw amount input to ensure it is a finite, positive number.
   *
   * @param {unknown} amountRaw - The raw input representing the amount to be parsed and validated.
   * @return {number} The validated amount as a finite, positive number.
   * @throws {InvalidAmountException} If the input is not a finite, positive number.
   */
  private parseAndValidateAmount(amountRaw: unknown): number {
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountException()
    }
    return amount
  }
}
