import { inject } from '@adonisjs/core'
import type { OperationActor } from '#aiglesend/operations/application/types/operation_actor'
import {
  PayMerchantRequestDto,
  type PayMerchantResponseDTO,
} from '#aiglesend/operations/application/dtos/pay_merchant.dto'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { PaymentMethod } from '#core/money/transactions/domain/enums/payment_method'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import IdentityGate from '#core/identity/authentication/application/services/identity_gate'
import PayableAliasService from '#core/qr/application/services/payable_alias_service'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import transferLog from '#shared/infrastructure/logging/transfer_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import MerchantNotFoundException from '#aiglesend/operations/domain/exceptions/merchant_not_found_exception'
import MerchantInactiveException from '#aiglesend/operations/domain/exceptions/merchant_inactive_exception'
import type {
  InternalMoveCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Use case **paiement marchand depuis le wallet aiglesend** — routeur mince (feature aiglesend→marchand).
 *
 * Un utilisateur scanne le **QR marchand** (alias payable) et paie **depuis son wallet** : mouvement
 * **interne** user → compte org, **sans frais** (décision produit). Le compte marchand est résolu
 * côté serveur ; son **nom** est passé au core (`recipientLabel`) pour la description ; le core
 * applique les **limites de réception** du niveau KYB du marchand (via `PartyValidator`).
 *
 * Gardes produit (blocage/throttle/appareil/PIN) → résolution marchand → `ExternalMoveCommand`
 * interne → `engine.moveInternal` → audit + réponse. Toute la mécanique argent vit dans le core.
 */
@inject()
export default class PayMerchantUseCase {
  constructor(
    private readonly payableAliasService: PayableAliasService,
    private readonly identityGate: IdentityGate,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: PayMerchantRequestDto,
    currentUser: OperationActor,
    idempotencyKey?: string
  ): Promise<PayMerchantResponseDTO> {
    transferLog.info(
      'MERCHANT_PAYMENT_START',
      { user: { id: currentUser.id, uid: currentUser.usersUid }, code: payload.code },
      'Starting merchant payment process'
    )

    // 1. Résolution du marchand (QR → compte org + nom).
    const merchant = await this.payableAliasService.resolve(payload.code)
    if (!merchant) {
      throw new MerchantNotFoundException()
    }
    if (!merchant.active) {
      throw new MerchantInactiveException()
    }

    // 2. Gardes produit (blocage/throttle/appareil + PIN — débit wallet).
    await this.identityGate.authorize({
      userId: currentUser.usersUid,
      kind: 'wallet_to_wallet',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      pincode: payload.pincode,
    })

    // 3. Commande de mouvement interne (sans frais : règle wallet `transfert × wallet × aigle`).
    const command: InternalMoveCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: currentUser.usersUid,
      type: TransactionType.CHECKOUT,
      fromAccountId: currentUser.usersUid,
      toAccountId: merchant.accountId,
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: PaymentMethod.WALLET,
        providerFromCode: 'aigle',
        includeFees: false,
      },
      metadata: {
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
        recipientLabel: merchant.displayName,
      },
    }

    const result = await this.engine.moveInternal(command)

    this.emitAudit(result, merchant.displayName, payload, currentUser)

    const response: PayMerchantResponseDTO = {
      message: 'Paiement marchand effectué avec succès',
      data: {
        reference: result.reference,
        status: result.status as TransactionStatus,
        merchant: merchant.displayName,
      },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(response)).catch((error) => {
        transferLog.error(
          'MERCHANT_PAYMENT_IDEMPOTENCY_UPDATE_FAILED',
          { transaction: { reference: result.reference }, error: error.message },
          'Failed to update idempotency cache for merchant payment'
        )
      })
    }

    return response
  }

  /**
   * Émet l'événement d'audit produit du paiement marchand (contexte requête : IP, user-agent, géo).
   * @private
   */
  private emitAudit(
    result: MovementResult,
    merchantName: string,
    payload: PayMerchantRequestDto,
    currentUser: OperationActor
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'MERCHANT_PAYMENT_INITIATED',
        actorId: String(currentUser.id),
        actorType: 'User',
        targetType: 'Transaction',
        targetId: result.movementId,
        result: AuditResult.SUCCESS,
        ipAddress: payload.ipAddress ?? payload.geoIpLocation?.ip ?? null,
        userAgent: payload.userAgent ?? null,
        requestId: payload.requestId ?? null,
        metadata: {
          reference: result.reference,
          amount: result.amount,
          merchant: merchantName,
          code: payload.code,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
  }
}
