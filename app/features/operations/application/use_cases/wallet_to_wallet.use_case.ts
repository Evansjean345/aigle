import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import {
  WalletToWalletRequestDto,
  WalletToWalletResponseDTO,
} from '#features/operations/application/dtos/operation.dto'
import WalletToWalletTransactionFailed from '#features/transactions/application/events/wallet_to_wallet_transaction_failed'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import WalletTransferContextService, {
  TransferContext,
  TransferMode,
} from '#features/operations/application/services/wallet_transfer_context_service'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import IdentityGate from '#features/authentication/application/services/identity_gate'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type {
  InternalMoveCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'

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
    private readonly contextFactory: WalletTransferContextService,
    private readonly identityGate: IdentityGate,
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

    await this.identityGate.authorize({
      user: currentUser,
      kind: 'wallet_to_wallet',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      pincode: payload.pincode,
    })

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

    // Effets de bord PRODUIT uniquement : audit (contexte requête). L'event de complétion
    // (notification, volume) est émis par l'engine (core) — le produit ne re-lit plus le core.
    this.emitAudit(result, context, payload, auditContext)

    const responseResult: WalletToWalletResponseDTO = {
      message: 'Transfert wallet-to-wallet effectué avec succès',
      data: { reference: result.reference, status: result.status as TransactionStatus },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(responseResult))
    }

    transferLog.info(
      'WALLET_TRANSFER_COMPLETED',
      {
        reference: idempotencyKey,
        sender: { transactionId: result.movementId },
        recipient: { transactionId: result.relatedReferences?.[0] },
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
    result: MovementResult,
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
        targetId: result.movementId,
        result: AuditResult.SUCCESS,
        ipAddress: auditContext.ipAddress ?? payload.geoIpLocation?.ip ?? null,
        userAgent: auditContext.userAgent ?? null,
        requestId: auditContext.requestId ?? null,
        metadata: {
          senderReference: result.reference,
          recipientReference: result.relatedReferences?.[0],
          amount: result.amount,
          fees: result.fees,
          total: result.total,
          recipientPhone: context.recipientWallet.user.phone,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
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
