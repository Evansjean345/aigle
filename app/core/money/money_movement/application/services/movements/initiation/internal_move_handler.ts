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

/**
 * Primitive `moveInternal` : compte → compte, atomique et synchrone.
 *
 * Porte sa propre transaction — débit source, crédit destination, écritures miroir de transaction
 * et de paiement, lignes du grand livre, statut final. Tout ou rien.
 */
@inject()
export default class InternalMoveHandler {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly feeResolver: FeeResolver,
    private readonly partyValidator: PartyValidator,
    private readonly activity: MoneyActivityEmitter
  ) {}

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
          // Symétrie avec le leg payeur : un encaissement marchand (`checkout`) est « Paiement reçu
          // de … » ; un P2P reste « Transfert reçu de … ».
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

      WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
        type: recipientWallet.userId ? 'p2p' : 'merchant',
        recipientPhone: recipientWallet.user?.phone ?? null,
        senderPhone: senderWallet.user.phone,
        recipientAccountId: recipientWallet.accountId ?? cmd.toAccountId,
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

  private async resolveWallet(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByAccountId(accountId)
    if (wallet.userId) await wallet.load('user')
    return wallet
  }

  /**
   * Valide le destinataire d'un mouvement interne — **account-centric** : user (w2w) comme marchand
   * (compte org) sont validés via `PartyValidator` (standing du compte : statut party + wallet actif
   * + limites du niveau). Le marchand est ainsi soumis aux **limites de réception** de son niveau KYB.
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
   * Crée le payment miroir d'une jambe interne. `payment_details` porte la **contrepartie** de la
   * jambe (privacy-first, taxonomie S3) :
   * - contrepartie **User** (P2P, ou payeur côté marchand) → `{ operator, phone, user }` (le `phone`
   *   sert à la résolution en contact côté app ; le nom n'est jamais exposé à un pair) ;
   * - contrepartie **marchand** (leg payeur d'un paiement marchand) → `{ operator, name }` : le
   *   **nom commercial** est exposable, contrairement à un nom d'utilisateur.
   *
   * @param transaction
   * @param counterparty
   * @param operationType Label métier de la jambe (`cmd.type`) — aligné sur la transaction.
   * @param trx
   * @param merchantLabel Nom du marchand, écrit quand la contrepartie est un marchand (User null).
   */
  private createInternalPayment(
    transaction: Transaction,
    counterparty: User | null,
    operationType: TransactionType,
    trx: TransactionClientContract,
    merchantLabel?: string | null
  ) {
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
