import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type {
  InternalMoveCommand,
  ExternalOutCommand,
  ExternalInCommand,
  ExternalToExternalCommand,
  ReverseCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'
import WalletService from '#features/wallet/application/services/wallet_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import PaymentService from '#features/transactions/application/services/payment_service'
import LedgerService from '#features/ledger/application/services/ledger_service'
import FeeCalculatorService from '#features/fees/application/services/fee_calculator_service'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionLimitValidationService from '#features/transactions/application/services/transaction_limit_validation_service'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import { PaymentStep } from '#features/transactions/domain/enums/payment_step'
import { PaymentMethod } from '#features/transactions/domain/enums/payment_method'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'
import type User from '#features/user/domain/models/user'
import type Transaction from '#features/transactions/domain/models/transaction'
import type Wallet from '#features/wallet/domain/models/wallet'
import type { DeviceHeadersInfo } from '#shared/middleware/device_middleware'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'
import type { TransactionLogEventData } from '#features/transactions/application/types/transaction_log_event_data'

/**
 * Implémentation du `MoneyMovementEngine` (core argent, Lot 2).
 *
 * L'engine possède TOUTE l'orchestration argent (L2-D6) : idempotence [différée], validations
 * comptes/fonds/limites, calcul des frais (service core `fees`), et — dans SA propre transaction
 * DB (L2-D5) — la création des records transaction+payment, les mouvements wallet, les écritures
 * ledger et la pose des statuts. Les use cases produit ne sont plus que des routeurs minces.
 *
 * Portée Lot 2 (ce commit) : `moveInternal` (pilote wallet_to_wallet). Les primitives externes et
 * `reverse` sont branchées dans les commits suivants (deposit → transfert → transfert_inter).
 */
@inject()
export default class MoneyMovementEngineImpl implements MoneyMovementEngine {
  constructor(
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
    private readonly paymentService: PaymentService,
    private readonly ledgerService: LedgerService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly accountValidationService: AccountValidationService,
    private readonly limitValidationService: TransactionLimitValidationService
  ) {}

  /**
   * Interne : compte → compte, atomique et synchrone (→ COMPLETED).
   * Port fidèle du chemin wallet_to_wallet : débit source / crédit destination, records miroir,
   * écritures ledger, le tout dans une trx possédée par le core (tout-ou-rien).
   */
  async moveInternal(cmd: InternalMoveCommand): Promise<MovementResult> {
    const senderWallet = await this.resolveWalletWithUser(cmd.fromAccountId)
    const recipientWallet = await this.resolveWalletWithUser(cmd.toAccountId)

    const { amount, fees, total } = await this.feeCalculatorService.calculateForService(
      {
        serviceTypeId: cmd.feeContext.serviceTypeId,
        paymentMethodId: cmd.feeContext.paymentMethodId,
        providerFromId: cmd.feeContext.providerFromId,
        providerToId: cmd.feeContext.providerToId,
      },
      { amount: cmd.amount, operation: 'subtract', include_fees: cmd.feeContext.includeFees }
    )

    await this.validateParty(senderWallet.user, total, TransactionDirection.DEBIT, false)
    await this.validateParty(recipientWallet.user, amount, TransactionDirection.CREDIT, true)

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

      this.emitInternalActivity(senderTx, recipientTx, senderWallet, recipientWallet, {
        amount,
        fees,
        total,
        senderBefore,
        senderAfter: debited.balance,
        recipientBefore,
        recipientAfter: credited.balance,
      })

      return {
        status: TransactionStatus.SUCCESS,
        movementId: String(senderTx.id),
        reference: senderTx.reference,
        relatedReferences: [recipientTx.reference],
      }
    } catch (error) {
      await trx.rollback()
      emitter
        .emit('activity:transaction-log', {
          event: 'FAILED',
          transactionId: 'unknown',
          errorMessage: error instanceof Error ? error.message : 'Internal move failed (rollback)',
        })
        .catch(() => {})
      throw error
    }
  }

  /** Externe sortant (transfert) — branché au commit dédié. */
  async initiateExternalOut(_cmd: ExternalOutCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalOut')
  }

  /** Externe entrant (deposit) — branché au commit dédié. */
  async initiateExternalIn(_cmd: ExternalInCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalIn')
  }

  /** Externe → externe (transfert_inter) — branché au commit dédié. */
  async initiateExternalToExternal(_cmd: ExternalToExternalCommand): Promise<MovementResult> {
    throw this.notImplemented('initiateExternalToExternal')
  }

  /** Contre-passation — différée (L2-D3). */
  async reverse(_cmd: ReverseCommand): Promise<MovementResult> {
    throw this.notImplemented('reverse')
  }

  // ── Interne ────────────────────────────────────────────────────────────

  private async resolveWalletWithUser(accountId: string): Promise<Wallet> {
    const wallet = await this.walletService.getByUserId(accountId)
    await wallet.load('user')
    return wallet
  }

  private async validateParty(
    user: User,
    amount: number,
    direction: TransactionDirection,
    isRecipient: boolean
  ): Promise<void> {
    await this.accountValidationService.validateAccount(user, isRecipient)
    await this.limitValidationService.validateTransactionLimit({
      user,
      amount,
      transactionType: TransactionType.WALLET_TRANSFERT,
      direction,
    })
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

  private emitInternalActivity(
    senderTx: Transaction,
    recipientTx: Transaction,
    senderWallet: Wallet,
    recipientWallet: Wallet,
    amounts: {
      amount: number
      fees: number
      total: number
      senderBefore: number
      senderAfter: number
      recipientBefore: number
      recipientAfter: number
    }
  ): void {
    const emit = (payload: TransactionLogEventData) =>
      emitter.emit('activity:transaction-log', payload).catch(() => {})

    emit({
      event: 'WALLET_DEBITED',
      transactionId: senderTx.reference,
      walletId: String(senderWallet.id),
      amount: amounts.total,
      balanceBefore: amounts.senderBefore,
      balanceAfter: amounts.senderAfter,
    })
    emit({
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
    emit({
      event: 'WALLET_CREDITED',
      transactionId: recipientTx.reference,
      walletId: String(recipientWallet.id),
      amount: amounts.total,
      balanceBefore: amounts.recipientBefore,
      balanceAfter: amounts.recipientAfter,
    })
    emit({
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
    emit({ event: 'SUCCESS', transactionId: senderTx.reference })
  }

  private notImplemented(primitive: string): Exception {
    return new Exception(`MoneyMovementEngine.${primitive} n'est pas encore implémenté (Lot 2)`, {
      status: 501,
      code: 'E_NOT_IMPLEMENTED',
    })
  }
}
