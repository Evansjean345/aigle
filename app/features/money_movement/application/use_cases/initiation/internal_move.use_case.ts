import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type {
  InternalMoveCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import FeeResolver from '#features/money_movement/application/services/fee_resolver'
import PartyValidator from '#features/money_movement/application/services/party_validator'
import MoneyActivityEmitter from '#features/money_movement/application/services/money_activity_emitter'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import WalletToWalletTransactionCompleted from '#features/transactions/application/events/wallet_to_wallet_transaction_completed'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import type User from '#features/user/domain/models/user'
import type Transaction from '#features/transactions/domain/models/transaction'
import type Wallet from '#features/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

/**
 * Use case de la primitive `moveInternal` (compte → compte, atomique, synchrone → COMPLETED).
 *
 * Use case du bounded context money_movement (le core), invoqué par la façade `MoneyMovementEngine`
 * (l'adaptateur du contrat), elle-même appelée par le use case produit (operations). Possède SA
 * `db.transaction` (L2-D5) : débit source / crédit destination, records transaction+payment miroir,
 * écritures ledger, statut COMPLETED — tout-ou-rien. Port fidèle du chemin wallet_to_wallet
 * historique (équivalence prouvée par la caractérisation).
 */
@inject()
export default class InternalMoveUseCase {
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
    const senderWallet = await this.resolveWalletWithUser(cmd.fromAccountId)
    const recipientWallet = await this.resolveWalletWithUser(cmd.toAccountId)

    const { amount, fees, total } = await this.feeResolver.resolve(cmd.feeContext, cmd.amount)

    await this.partyValidator.validate({
      user: senderWallet.user,
      amount: total,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction: TransactionDirection.DEBIT,
    })
    await this.partyValidator.validate({
      user: recipientWallet.user,
      amount,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction: TransactionDirection.CREDIT,
      isRecipient: true,
    })

    const { deviceInfo, geoIpLocation } = this.extractRequestContext(cmd)
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
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Transfert à ${recipientWallet.user.firstname} ${recipientWallet.user.lastname}`,
          idempotency: cmd.idempotencyKey || undefined,
        },
        senderWallet.id,
        senderWallet.user,
        deviceInfo,
        geoIpLocation,
        trx
      )
      await this.createInternalPayment(senderTx, recipientWallet.user, trx)
      await this.ledgerService.recordWalletTransfer(
        {
          transaction: senderTx,
          walletId: senderWallet.id,
          direction: LedgerDirection.DEBIT,
          amount: total,
          fees,
          balanceBefore: senderBefore,
          balanceAfter: debited.balance,
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
          operation_type: TransactionType.WALLET_TRANSFERT,
          description: `Transfert reçu de ${senderWallet.user.firstname} ${senderWallet.user.lastname}`,
        },
        recipientWallet.id,
        recipientWallet.user,
        deviceInfo,
        geoIpLocation,
        trx
      )
      await this.createInternalPayment(recipientTx, senderWallet.user, trx)
      await this.ledgerService.recordWalletTransfer(
        {
          transaction: recipientTx,
          walletId: recipientWallet.id,
          direction: LedgerDirection.CREDIT,
          amount: total,
          fees: 0,
          balanceBefore: recipientBefore,
          balanceAfter: credited.balance,
        },
        trx
      )

      await trx.commit()

      this.emitActivity(senderTx, recipientTx, senderWallet, recipientWallet, {
        fees,
        total,
        senderBefore,
        senderAfter: debited.balance,
        recipientBefore,
        recipientAfter: credited.balance,
      })

      // Fait argent « mouvement interne réglé » émis par le CORE (l'engine possède les records).
      // Le produit ne re-lit plus les transactions pour dispatcher : les listeners (volume,
      // notification) écoutent cet event core.
      WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
        recipientPhone: recipientWallet.user.phone,
        senderPhone: senderWallet.user.phone,
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

  private async resolveWalletWithUser(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByUserId(accountId)
    await wallet.load('user')
    return wallet
  }

  private extractRequestContext(cmd: InternalMoveCommand): {
    deviceInfo?: DeviceHeadersInfo
    geoIpLocation?: GeoIpLocation
  } {
    const meta = (cmd.metadata ?? {}) as {
      deviceInfo?: DeviceHeadersInfo
      geoIpLocation?: GeoIpLocation
    }
    return { deviceInfo: meta.deviceInfo, geoIpLocation: meta.geoIpLocation }
  }

  private createInternalPayment(
    transaction: Transaction,
    counterparty: User,
    trx: TransactionClientContract
  ) {
    return this.paymentService.createPayment(
      {
        payment_method: PaymentMethod.INTERNAL,
        operation_type: TransactionType.WALLET_TRANSFERT,
        payment_details: {
          operator: PaymentMethod.WALLET,
          phone: counterparty.phone,
          user: `${counterparty.firstname} ${counterparty.lastname}`,
        },
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
    amounts: {
      fees: number
      total: number
      senderBefore: number
      senderAfter: number
      recipientBefore: number
      recipientAfter: number
    }
  ): void {
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
