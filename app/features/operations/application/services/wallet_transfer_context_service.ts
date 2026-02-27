import { inject } from '@adonisjs/core'
import User from '#features/users/domain/models/user'
import Wallet from '#features/wallet/domain/models/wallet'
import WalletService from '#features/wallet/application/services/wallet_service'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
import { WalletToWalletRequestDto } from '#features/operations/application/dto/wallet_to_wallet.dto'
import ModeUnsupportedException from '#features/operations/infrastructure/exceptions/mode_unsupported_exception'
import InvalidAmountException from '#features/operations/infrastructure/exceptions/invalid_amount_exception'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import PaymentMethodRepository from '#features/catalogs/domain/interfaces/payment_method_repository'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import ProviderRepository from '#features/catalogs/domain/interfaces/provider_repository'

export enum TransferMode {
  BY_QRCODE = 'by_qrcode',
  BY_PHONE = 'by_phone',
}

export interface TransferContext {
  senderWallet: Wallet
  recipientWallet: Wallet
  amount: number
  fees: number
  total: number
  currentUser: User
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
   * @param feeCalculatorService - The service responsible for calculating transaction fees.
   * @param serviceTypeRepository - The repository responsible for retrieving and managing service types.
   * @param paymentMethodRepository - The repository responsible for retrieving and managing payment methods.
   * @param providerRepository - The repository responsible for retrieving and managing providers.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly countryRepository: CountryRepository,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly providerRepository: ProviderRepository
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
    const [senderWallet, senderCountry, serviceType, paymentMethod, provider] = await Promise.all([
      this.walletService.getByUserId(currentUser.usersUid!).then(async (w) => {
        await w.load('user')
        return w
      }),
      this.countryRepository.findCountryBy('id', currentUser.countryId),
      this.serviceTypeRepository.findByCode(TransactionType.TRANSFERT),
      this.paymentMethodRepository.findByCode(PaymentMethod.WALLET),
      this.providerRepository.findByCode('aigle'),
    ])

    const recipientWallet = await this.resolveRecipient(
      mode,
      payload,
      currentUser.usersUid!,
      senderCountry.phoneCode
    )

    await recipientWallet.load('user')

    const amountRaw = this.parseAndValidateAmount(payload.amount)

    const { amount, fees, total } = await this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: serviceType.id,
        paymentMethodId: paymentMethod.id,
        providerFromId: provider.id, // No specific provider for wallet to wallet
      },
      {
        amount: amountRaw,
        operation: 'subtract',
        include_fees: payload.include_fees,
      }
    )

    return {
      senderWallet,
      recipientWallet,
      amount,
      fees,
      total,
      currentUser,
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
          payload.recipient_phone!,
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
