import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import WalletService from '#features/wallet/application/services/wallet_service'
import { type RecipientAccountResult } from '#features/wallet/application/dtos/wallet.dto'
import {
  WalletToWalletRequestDto,
  type RecipientResolution,
} from '#features/operations/application/dtos/wallet_to_wallet.dto'
import CountryRepository from '#features/country/domain/interfaces/country_repository'
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

    const recipient = await this.resolveRecipient(
      mode,
      payload,
      currentUser.usersUid!,
      senderCountry.phoneCode
    )

    const amount = this.parseAndValidateAmount(payload.amount)

    return {
      recipientUsersUid: recipient.usersUid,
      recipientPhone: recipient.phone,
      amount,
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: PaymentMethod.WALLET,
        providerFromCode: 'aigle',
      },
    }
  }

  /**
   * Résout le compte destinataire selon le mode d'adressage :
   * - `by_qrcode` : via le token QR ;
   * - `by_phone` : via le numéro + l'indicatif pays de l'émetteur.
   *
   * La résolution ET la projection vivent dans wallet-core (couche propriétaire de la donnée) :
   * le modèle ORM `Wallet` n'est jamais connu ici ; on ne reçoit qu'un `RecipientAccountResult`. Ce
   * routeur ne décide que du MODE d'adressage (QR vs téléphone), concept produit.
   * @private
   */
  private async resolveRecipient(
    mode: TransferMode,
    payload: WalletToWalletRequestDto,
    senderUserId: string,
    phoneCode: string
  ): Promise<RecipientAccountResult> {
    switch (mode) {
      case TransferMode.BY_QRCODE:
        return this.walletService.resolveRecipientByToken(payload.token)
      case TransferMode.BY_PHONE:
        return this.walletService.resolveRecipientByPhone(
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
