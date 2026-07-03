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

/** Mode d'adressage produit du bénéficiaire d'un transfert wallet-to-wallet. */
export enum TransferMode {
  BY_QRCODE = 'by_qrcode',
  BY_PHONE = 'by_phone',
}

/**
 * Bénéficiaire résolu + entrées de commande argent, prêts à alimenter l'engine.
 *
 * Volontairement minimal : le compte destinataire (identifiant money-core) et son téléphone
 * (pour l'audit produit), le montant validé, et les codes de tarification. Aucun modèle `Wallet`
 * n'en sort — l'engine résout lui-même les deux wallets et la mécanique argent.
 */
export interface RecipientResolution {
  recipientUsersUid: string
  recipientPhone: string
  amount: number
  feeContext: {
    serviceTypeCode: string
    paymentMethodCode: string
    providerFromCode: string
  }
}

/**
 * Localisateur de bénéficiaire (produit).
 *
 * Traduit une **adresse produit** (QR token ou numéro de téléphone) en **identifiant de compte**
 * (`usersUid`) que le contrat de l'engine attend, en composant les primitives wallet-core /
 * country-core en lecture (read-side query, produit→core autorisé). Le token QR et le numéro sont
 * des concepts de présentation qui ne doivent pas descendre dans le money-core ; cette traduction
 * est donc du ressort du routeur produit, au-dessus de l'engine.
 *
 * Ne charge PAS le wallet émetteur ni ne calcule de frais : l'engine est autosuffisant à partir
 * de l'UID initiateur et des codes (ADR-0013).
 */
@inject()
export default class RecipientLocator {
  constructor(
    private readonly walletService: WalletService,
    private readonly countryRepository: CountryRepository
  ) {}

  /**
   * Résout le bénéficiaire désigné par `mode` (QR/téléphone) et prépare les entrées de commande.
   */
  async locate(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode
  ): Promise<RecipientResolution> {
    const senderCountry = await this.countryRepository.findCountryBy('id', currentUser.countryId)

    const recipientWallet = await this.resolveRecipient(
      mode,
      payload,
      currentUser.usersUid!,
      senderCountry.phoneCode
    )
    await recipientWallet.load('user')

    const amount = this.parseAndValidateAmount(payload.amount)

    return {
      recipientUsersUid: recipientWallet.user.usersUid,
      recipientPhone: recipientWallet.user.phone,
      amount,
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: PaymentMethod.WALLET,
        providerFromCode: 'aigle',
      },
    }
  }

  /**
   * Résout le wallet destinataire selon le mode d'adressage :
   * - `by_qrcode` : via le token QR ;
   * - `by_phone` : via le numéro + l'indicatif pays de l'émetteur.
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
   * Valide que le montant est un nombre fini strictement positif.
   * @throws {InvalidAmountException} Si l'entrée n'est pas un nombre fini positif.
   * @private
   */
  private parseAndValidateAmount(amountRaw: unknown): number {
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidAmountException()
    }
    return amount
  }
}
