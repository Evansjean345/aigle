import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  InternalMoveCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import PaymentService from '#core/money/transactions/application/services/payment_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import PartyValidator from '#core/money/money_movement/application/services/party_validator'
import MoneyActivityEmitter from '#core/money/money_movement/application/services/money_activity_emitter'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#core/money/transactions/domain/enums/payment_status'
import { PaymentStep } from '#core/money/transactions/domain/enums/payment_step'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'
import { LedgerDirection } from '#core/money/ledger/domain/ledger_enums'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import type User from '#core/identity/user/domain/models/user'
import type Transaction from '#core/money/transactions/domain/models/transaction'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import Payment from '#core/money/transactions/domain/models/payment'

/**
 * Primitive `moveInternal` : compte → compte, atomique et synchrone.
 *
 * Porte sa propre transaction — débit source, crédit destination, écritures miroir de transaction
 * et de paiement, lignes du grand livre, statut final. Tout ou rien.
 */
@inject()
export default class InternalMoveHandler {
  /**
   * Construit le gestionnaire de mouvement interne.
   *
   * @param {WalletService} walletService - Portefeuilles et mouvements de solde.
   * @param {TransactionService} transactionService - Écriture des transactions.
   * @param {PaymentService} paymentService - Écriture des paiements miroirs.
   * @param {LedgerService} ledgerService - Écriture au grand livre.
   * @param {FeeResolver} feeResolver - Frais applicables au mouvement.
   * @param {PartyValidator} partyValidator - Gardes de compte, de portefeuille et de plafond.
   * @param {MoneyActivityEmitter} activity - Journal d'activité du mouvement.
   * @param {AccountStandingService} accountStandingService - Registre des comptes.
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly feeResolver: FeeResolver,
    private readonly partyValidator: PartyValidator,
    private readonly activity: MoneyActivityEmitter,
    private readonly accountStandingService: AccountStandingService
  ) {}

  /**
   * Déplace un montant d'un compte à un autre.
   *
   * @param {InternalMoveCommand} cmd - Comptes, montant, nature du mouvement et contexte d'appel.
   * @returns {Promise<MovementResult>} Les deux jambes écrites et leur référence.
   * @throws {Exception} Le crédit du compte destinataire a échoué : la transaction est annulée.
   */
  async handle(cmd: InternalMoveCommand): Promise<MovementResult> {
    const senderWallet = await this.resolveWallet(cmd.fromAccountId)
    const recipientWallet = await this.resolveWallet(cmd.toAccountId)

    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.partyValidator.validate({
      accountId: senderWallet.accountId ?? cmd.fromAccountId,
      amount: total,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction: TransactionDirection.DEBIT,
    })

    await this.validateRecipient(recipientWallet, amount, cmd.toAccountId)

    const { deviceInfo, geoIpLocation, recipientLabel } = this.extractRequestContext(cmd)
    const senderBefore = Number(senderWallet.balance)
    const recipientBefore = Number(recipientWallet.balance)

    const trx = await db.transaction()

    try {
      const debited = await this.walletService.debitBalance(senderWallet.id, amount, trx)
      const senderTx = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.SUCCESS,
          amount,
          direction: TransactionDirection.DEBIT,
          total_amount: total,
          fees,
          balanceAfter: debited.balance,
          operation_type: cmd.type,
          description: recipientWallet.user
            ? `Transfert à ${recipientWallet.user.firstname} ${recipientWallet.user.lastname}`
            : recipientLabel
              ? `Paiement à ${recipientLabel}`
              : 'Paiement marchand',
          idempotency: cmd.idempotencyKey || undefined,
        },
        senderWallet.id,
        senderWallet.user,
        deviceInfo,
        geoIpLocation,
        trx,
        senderWallet.accountId ?? cmd.fromAccountId
      )

      await this.createInternalPayment(
        senderTx,
        recipientWallet.user,
        cmd.type,
        trx,
        recipientLabel
      )
      await this.ledgerService.recordWalletTransfer(
        {
          transaction: senderTx,
          walletId: senderWallet.id,
          direction: LedgerDirection.DEBIT,
          amount: total,
          fees,
          balanceBefore: senderBefore,
          balanceAfter: debited.balance,
          operationType: TransactionType.WALLET_TRANSFERT,
        },
        trx
      )

      const credited = await this.walletService.creditBalance(recipientWallet.id, total, trx)

      if (!credited) {
        throw new Exception('Échec du crédit du compte destinataire', {
          status: 500,
          code: 'E_WALLET_CREDIT_FAILED',
        })
      }
      const recipientTx = await this.transactionService.createTransaction(
        {
          status: TransactionStatus.SUCCESS,
          amount: total,
          direction: TransactionDirection.CREDIT,
          total_amount: total,
          fees: 0,
          balanceAfter: credited.balance,
          operation_type: cmd.type,
          description:
            cmd.type === TransactionType.CHECKOUT
              ? `Paiement reçu de ${senderWallet.user.firstname} ${senderWallet.user.lastname}`
              : `Transfert reçu de ${senderWallet.user.firstname} ${senderWallet.user.lastname}`,
        },
        recipientWallet.id,
        recipientWallet.user,
        deviceInfo,
        geoIpLocation,
        trx,
        recipientWallet.accountId ?? cmd.toAccountId
      )

      await this.createInternalPayment(recipientTx, senderWallet.user, cmd.type, trx)
      await this.ledgerService.recordWalletTransfer(
        {
          transaction: recipientTx,
          walletId: recipientWallet.id,
          direction: LedgerDirection.CREDIT,
          amount: total,
          fees: 0,
          balanceBefore: recipientBefore,
          balanceAfter: credited.balance,
          operationType: TransactionType.WALLET_TRANSFERT,
        },
        trx
      )

      await trx.commit()

      this.emitActivity(senderTx, recipientTx, senderWallet, recipientWallet, cmd, {
        fees,
        total,
        senderBefore,
        senderAfter: debited.balance,
        recipientBefore,
        recipientAfter: credited.balance,
      })

      const recipientAccountId = recipientWallet.accountId ?? cmd.toAccountId
      const recipient = await this.accountStandingService.describe(recipientAccountId)
      const recipientOwnerType = recipient?.ownerType ?? AccountOwnerType.USER

      WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
        type: recipientOwnerType === AccountOwnerType.ORGANISATION ? 'merchant' : 'p2p',
        recipientPhone: recipientWallet.user?.phone ?? null,
        senderPhone: senderWallet.user.phone,
        senderAccountId: senderWallet.accountId ?? cmd.fromAccountId,
        recipientAccountId,
        senderBalanceAfter: debited.balance,
        recipientBalanceAfter: credited.balance,
      }).catch((err) =>
        transferLog.error(
          'EVENT_DISPATCH_FAILED',
          { error: err instanceof Error ? err.message : 'Unknown error' },
          'Failed to dispatch wallet-to-wallet completion event'
        )
      )

      return {
        status: TransactionStatus.SUCCESS,
        movementId: String(senderTx.id),
        reference: senderTx.reference,
        amount,
        fees,
        total,
        relatedReferences: [recipientTx.reference],
      }
    } catch (error) {
      await trx.rollback()
      this.activity.failed(
        error instanceof Error ? error.message : 'Internal move failed (rollback)'
      )
      throw error
    }
  }

  /**
   * Charge le portefeuille d'un compte, son porteur préchargé s'il en a un.
   *
   * @param {string} accountId - Compte titulaire.
   * @returns {Promise<Wallet>} Le portefeuille.
   */
  private async resolveWallet(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByAccountId(accountId)
    if (wallet.userId) await wallet.load('user')
    return wallet
  }

  /**
   * Vérifie que le compte destinataire peut recevoir le montant.
   *
   * La vérification porte sur le compte, qu'il appartienne à une personne ou à une organisation :
   * un marchand est donc soumis aux plafonds de réception de son palier, comme un particulier.
   *
   * @param {Wallet} wallet - Portefeuille du destinataire.
   * @param {number} amount - Montant à créditer.
   * @param {string} accountId - Compte destinataire, à défaut de celui du portefeuille.
   * @returns {Promise<void>} Rien : la méthode lève si la réception est refusée.
   */
  private async validateRecipient(
    wallet: Wallet,
    amount: number,
    accountId: string
  ): Promise<void> {
    await this.partyValidator.validate({
      accountId: wallet.accountId ?? accountId,
      amount,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction: TransactionDirection.CREDIT,
      isRecipient: true,
    })
  }

  /**
   * Extrait de la commande ce que les écritures ont besoin de connaître de l'appel.
   *
   * @param {InternalMoveCommand} cmd - Commande du mouvement.
   * @returns {object} L'appareil, la localisation et le nom du marchand, quand ils sont fournis.
   */
  private extractRequestContext(cmd: InternalMoveCommand): {
    deviceInfo?: DeviceHeadersInfo
    geoIpLocation?: GeoIpLocation
    recipientLabel?: string
  } {
    const meta = (cmd.metadata ?? {}) as {
      deviceInfo?: DeviceHeadersInfo
      geoIpLocation?: GeoIpLocation
      recipientLabel?: string
    }
    return {
      deviceInfo: meta.deviceInfo,
      geoIpLocation: meta.geoIpLocation,
      recipientLabel: meta.recipientLabel,
    }
  }

  /**
   * Écrit le paiement miroir d'une jambe, avec sa contrepartie.
   *
   * Une contrepartie personne n'est désignée que par son numéro : le nom sert à la résolution en
   * contact côté application et n'est pas rendu à un pair. Un marchand porte son nom commercial,
   * qui est son identité publique.
   *
   * @param {Transaction} transaction - Jambe à laquelle le paiement se rattache.
   * @param {User | null} counterparty - Personne en face, `null` face à un marchand.
   * @param {TransactionType} operationType - Nature du mouvement, alignée sur la transaction.
   * @param {TransactionClientContract} trx - Transaction englobante.
   * @param {string} [merchantLabel] - Nom du marchand, quand la contrepartie en est un.
   * @returns {Promise<Payment>} Le paiement écrit.
   */
  private createInternalPayment(
    transaction: Transaction,
    counterparty: User | null,
    operationType: TransactionType,
    trx: TransactionClientContract,
    merchantLabel?: string | null
  ): Promise<Payment> {
    return this.paymentService.createPayment(
      {
        payment_method: PaymentMethod.INTERNAL,
        operation_type: operationType,
        payment_details: counterparty
          ? {
              operator: PaymentMethod.WALLET,
              phone: counterparty.phone,
              user: `${counterparty.firstname} ${counterparty.lastname}`,
            }
          : merchantLabel
            ? { operator: PaymentMethod.WALLET, name: merchantLabel }
            : { operator: PaymentMethod.WALLET },
        status: PaymentStatus.SUCCESS,
        step: PaymentStep.WALLET_TO_WALLET,
      },
      transaction,
      counterparty,
      trx
    )
  }

  /**
   * Journalise les étapes du mouvement, une fois les écritures validées.
   *
   * @param {Transaction} senderTx - Jambe du payeur.
   * @param {Transaction} recipientTx - Jambe du destinataire.
   * @param {Wallet} senderWallet - Portefeuille débité.
   * @param {Wallet} recipientWallet - Portefeuille crédité.
   * @param {InternalMoveCommand} cmd - Commande du mouvement.
   * @param {object} amounts - Frais, total et soldes de part et d'autre.
   * @returns {void} Rien : le journal ne bloque pas le mouvement.
   */
  private emitActivity(
    senderTx: Transaction,
    recipientTx: Transaction,
    senderWallet: Wallet,
    recipientWallet: Wallet,
    cmd: InternalMoveCommand,
    amounts: {
      fees: number
      total: number
      senderBefore: number
      senderAfter: number
      recipientBefore: number
      recipientAfter: number
    }
  ): void {
    const meta = (cmd.metadata ?? {}) as { geoIpLocation?: GeoIpLocation }

    this.activity.emit({
      event: 'CREATED',
      transactionId: senderTx.reference,
      amount: Number(senderTx.amount),
      fees: amounts.fees,
      total: amounts.total,
      provider: 'aigle',
      paymentMethod: PaymentMethod.WALLET,
      transactionType: cmd.type,
      actorId: cmd.initiatedBy,
      ipAddress: meta.geoIpLocation?.ip ?? null,
    })
    this.activity.emit({
      event: 'VALIDATION_PASSED',
      transactionId: senderTx.reference,
      checks: ['sender_account', 'recipient_account', 'wallets', 'limits'],
      actorId: cmd.initiatedBy,
    })
    this.activity.emit({
      event: 'FEES_CALCULATED',
      transactionId: senderTx.reference,
      amount: Number(senderTx.amount),
      fees: amounts.fees,
      total: amounts.total,
    })

    this.activity.emit({
      event: 'WALLET_DEBITED',
      transactionId: senderTx.reference,
      walletId: String(senderWallet.id),
      amount: amounts.total,
      balanceBefore: amounts.senderBefore,
      balanceAfter: amounts.senderAfter,
    })
    this.activity.emit({
      event: 'LEDGER_ENTRY_CREATED',
      transactionId: senderTx.reference,
      walletId: String(senderWallet.id),
      direction: 'debit',
      amountBrut: amounts.total,
      fees: amounts.fees,
      totalAmount: amounts.total,
      balanceBefore: amounts.senderBefore,
      balanceAfter: amounts.senderAfter,
      operationType: 'wallet_transfert',
    })
    this.activity.emit({
      event: 'WALLET_CREDITED',
      transactionId: recipientTx.reference,
      walletId: String(recipientWallet.id),
      amount: amounts.total,
      balanceBefore: amounts.recipientBefore,
      balanceAfter: amounts.recipientAfter,
    })
    this.activity.emit({
      event: 'LEDGER_ENTRY_CREATED',
      transactionId: recipientTx.reference,
      walletId: String(recipientWallet.id),
      direction: 'credit',
      amountBrut: amounts.total,
      fees: 0,
      totalAmount: amounts.total,
      balanceBefore: amounts.recipientBefore,
      balanceAfter: amounts.recipientAfter,
      operationType: 'wallet_transfert',
    })
    this.activity.emit({ event: 'SUCCESS', transactionId: senderTx.reference })
  }
}
