import { inject } from '@adonisjs/core'
import TransactionService from '#features/transactions/application/services/transaction_service'
import User from '#features/user/domain/models/user'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDTO,
} from '#features/operations/application/dtos/operation.dto'
import Wallet from '#features/wallet/domain/models/wallet'
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import WalletToWalletTransactionFailed from '#features/operations/application/events/wallet_to_wallet_transaction_failed'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import WalletTransferContextService, {
  TransferContext,
  TransferMode,
} from '#features/operations/application/services/wallet_transfer_context_service'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type { InternalMoveCommand } from '#features/money_movement/domain/types/money_movement_types'

interface AuditContext {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

/**
 * Use case wallet_to_wallet — routeur mince (Lot 2, L2-D6).
 *
 * Le produit ne fait que : gardes (blocage/throttle/appareil/PIN), résolution du destinataire
 * (téléphone/QR) et des IDs de frais, construction de la commande, appel de l'engine, puis ses
 * effets de bord produit (audit + notification). TOUTE la mécanique argent (records, wallet,
 * ledger, statuts, frais, atomicité) vit dans le `MoneyMovementEngine`.
 */
@inject()
export default class WalletToWalletUseCase {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly contextFactory: WalletTransferContextService,
    private readonly accountValidationService: AccountValidationService,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  /**
   * Exécute un transfert wallet-to-wallet : gardes produit → résolution du contexte → commande
   * engine → effets de bord produit. L'atomicité et le tout-ou-rien sont garantis par l'engine.
   */
  async execute(
    payload: WalletToWalletRequestDto,
    currentUser: User,
    mode: TransferMode,
    idempotencyKey?: string
  ): Promise<WalletToWalletResponseDTO> {
    this.logTransferStart(currentUser, mode, payload)

    await this.failureCache.verifyNotBlocked(currentUser.usersUid)
    await this.throttleCache.verifyThrottle(currentUser.usersUid)

    await Promise.all([
      this.accountValidationService.validateDevice(
        currentUser,
        payload.deviceInfo,
        payload.geoIpLocation
      ),
      this.accountValidationService.verifyPinForUser(currentUser, payload.pincode),
    ])

    const context = await this.contextFactory.create(payload, currentUser, mode)

    const auditContext: AuditContext = {
      ipAddress: payload.ipAddress ?? payload.geoIpLocation?.ip ?? null,
      userAgent: payload.userAgent ?? null,
      requestId: payload.requestId ?? null,
    }

    return this.dispatchToEngine(context, payload, currentUser, auditContext, idempotencyKey)
  }

  /**
   * Traduit le contexte en commande, délègue à l'engine, puis rejoue les effets de bord produit.
   */
  private async dispatchToEngine(
    context: TransferContext,
    payload: WalletToWalletRequestDto,
    currentUser: User,
    auditContext: AuditContext,
    idempotencyKey?: string
  ): Promise<WalletToWalletResponseDTO> {
    const { senderWallet, recipientWallet } = context

    const command: InternalMoveCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: context.amount,
      currency: senderWallet.currencySymbol ?? 'XOF',
      initiatedBy: currentUser.usersUid,
      type: TransactionType.WALLET_TRANSFERT,
      fromAccountId: currentUser.usersUid,
      toAccountId: recipientWallet.user.usersUid,
      feeContext: {
        ...context.feeContext,
        includeFees: payload.includeFees,
      },
      metadata: {
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    let result
    try {
      result = await this.engine.moveInternal(command)
    } catch (error) {
      await WalletToWalletTransactionFailed.dispatch({
        userId: currentUser.usersUid,
        amount: context.amount,
        recipientPhone: recipientWallet.user.phone,
      })
      throw error
    }

    const senderTx = await this.transactionService.findByReference(result.reference)
    const recipientTx = await this.transactionService.findByReference(result.relatedReferences![0])

    this.emitAudit(senderTx, recipientTx, context, payload, auditContext)

    const responseResult: WalletToWalletResponseDTO = {
      message: 'Transfert wallet-to-wallet effectué avec succès',
      data: { reference: result.reference, status: result.status as TransactionStatus },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(responseResult))
    }

    this.dispatchCompletionEvent(senderTx, recipientTx, senderWallet, recipientWallet)

    transferLog.info(
      'WALLET_TRANSFER_COMPLETED',
      {
        reference: idempotencyKey,
        sender: { transactionId: senderTx.id },
        recipient: { transactionId: recipientTx.id },
      },
      'Wallet-to-wallet transfer completed'
    )

    return responseResult
  }

  /**
   * Émet l'événement d'audit produit (contexte requête : IP, user-agent, géo).
   * @private
   */
  private emitAudit(
    senderTx: Transaction,
    recipientTx: Transaction,
    context: TransferContext,
    payload: WalletToWalletRequestDto,
    auditContext: AuditContext
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'W2W_INITIATED',
        actorId: String(context.currentUser.id),
        actorType: 'User',
        targetType: 'Transaction',
        targetId: String(senderTx.id),
        result: AuditResult.SUCCESS,
        ipAddress: auditContext.ipAddress ?? payload.geoIpLocation?.ip ?? null,
        userAgent: auditContext.userAgent ?? null,
        requestId: auditContext.requestId ?? null,
        metadata: {
          senderReference: senderTx.reference,
          recipientReference: recipientTx.reference,
          amount: context.amount,
          fees: context.fees,
          total: context.total,
          recipientPhone: context.recipientWallet.user.phone,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
  }

  /**
   * Notifie la fin du transfert (canal produit). Best-effort, ne bloque pas la réponse.
   * @private
   */
  private dispatchCompletionEvent(
    senderTx: Transaction,
    recipientTx: Transaction,
    senderWallet: Wallet,
    recipientWallet: Wallet
  ): void {
    WalletToWalletTransactionCompleted.dispatch(senderTx, recipientTx, {
      recipientPhone: recipientWallet.user.phone,
      senderPhone: senderWallet.user.phone,
    }).catch((err) =>
      transferLog.error(
        'EVENT_DISPATCH_FAILED',
        { error: err instanceof Error ? err.message : 'Unknown error' },
        'Failed to dispatch completion event'
      )
    )
  }

  /**
   * Journalise le début d'un transfert wallet-to-wallet.
   * @private
   */
  private logTransferStart(
    user: User,
    mode: TransferMode,
    payload: WalletToWalletRequestDto
  ): void {
    transferLog.info(
      'WALLET_TRANSFER_STARTED',
      {
        user: { id: user.id },
        transfer: {
          mode,
          ...(mode === TransferMode.BY_QRCODE && { qrcode: payload.token }),
          ...(mode === TransferMode.BY_PHONE && { recipientPhone: payload.recipientPhone }),
          amount: payload.amount,
        },
      },
      'Starting wallet-to-wallet transfer'
    )
  }
}
