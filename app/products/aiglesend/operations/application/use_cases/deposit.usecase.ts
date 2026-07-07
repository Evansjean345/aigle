import {
  DepositRequestDto,
  DepositResponseDTO,
} from '#aiglesend/operations/application/dtos/deposit.dto'
import { inject } from '@adonisjs/core'
import type { OperationActor } from '#aiglesend/operations/application/types/operation_actor'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import IdentityGate from '#core/authentication/application/services/identity_gate'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalInCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Use case deposit — routeur mince (Lot 2, L2-D6).
 *
 * Gardes produit (blocage, appareil, téléphone débiteur) → mapping payload → `ExternalInCommand`
 * → `engine.initiateExternalIn` → effets de bord produit (audit) + réponse. Toute la mécanique
 * argent (frais, records, initiation externe, statuts) vit dans le core.
 */
@inject()
export default class DepositUseCase {
  constructor(
    private readonly identityGate: IdentityGate,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: DepositRequestDto,
    user: OperationActor,
    idempotencyKey?: string
  ): Promise<DepositResponseDTO> {
    transactionLog.info(
      'DEPOSIT_START',
      { user: { id: user.id, uid: user.usersUid }, payload: { ...payload } },
      'Starting deposit process'
    )

    await this.identityGate.authorize({
      userId: user.usersUid,
      kind: 'deposit',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      debitPhone: { phone: payload.phone, providerId: payload.providerId },
    })

    const command: ExternalInCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: user.usersUid,
      type: payload.serviceType as TransactionType,
      toAccountId: user.usersUid,
      source: { operator: payload.providerCode, msisdn: payload.phone, country: 'ci' },
      feeContext: {
        serviceTypeCode: payload.serviceType,
        paymentMethodCode: payload.paymentMethodCode,
        providerFromCode: payload.providerCode,
      },
      metadata: {
        paymentMethodCode: payload.paymentMethodCode,
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalIn(command)
    this.emitAudit(result, payload, user)

    const response: DepositResponseDTO = {
      message: 'transaction initiated',
      data: {
        transactionReference: result.reference,
        status: result.status,
        ...(result.providerData
          ? {
              redirectUrl: result.providerData.redirectUrl as string | undefined,
              type: result.providerData.type as string | undefined,
            }
          : {}),
      },
    }

    if (idempotencyKey) {
      await this.idempotency.update(idempotencyKey, JSON.stringify(response)).catch((error) => {
        transactionLog.error(
          'DEPOSIT_CHECKOUT_FAILED',
          { transaction: { reference: result.reference }, error: error.message },
          'Idempotency cache update failed for deposit'
        )
      })
    }

    return response
  }

  /**
   * Émet l'événement d'audit produit du dépôt (contexte requête : IP, user-agent, géo).
   * @private
   */
  private emitAudit(
    result: MovementResult,
    payload: DepositRequestDto,
    user: OperationActor
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'DEPOSIT_INITIATED',
        actorId: String(user.id),
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
          fees: result.fees,
          total: result.total,
          provider: payload.providerCode,
          paymentMethod: payload.paymentMethodCode,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
  }
}
