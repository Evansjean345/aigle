import {
  TransfertRequestDto,
  TransfertResponseDTO,
} from '#aiglesend/operations/application/dtos/transfert.dto'
import { inject } from '@adonisjs/core'
import type { OperationActor } from '#aiglesend/operations/application/types/operation_actor'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import IdentityGate from '#core/identity/authentication/application/services/identity_gate'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalOutCommand,
  MovementResult,
} from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Use case transfert — routeur mince (Lot 2, L2-D6).
 *
 * Gardes produit (blocage, throttle, appareil, PIN) → mapping payload → `ExternalOutCommand` →
 * `engine.initiateExternalOut` → effets de bord produit (audit) + réponse. Le débit immédiat
 * (réservation), les records, le ledger et l'initiation externe vivent dans le core.
 */
@inject()
export default class TransfertUseCase {
  constructor(
    private readonly identityGate: IdentityGate,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: TransfertRequestDto,
    user: OperationActor,
    idempotencyKey?: string
  ): Promise<TransfertResponseDTO> {
    paymentLog.info(
      'TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting transfer process'
    )

    await this.identityGate.authorize({
      userId: user.usersUid,
      kind: 'transfert',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      pincode: payload.pinCode!,
    })

    const command: ExternalOutCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: user.usersUid,
      type: payload.serviceType as TransactionType,
      fromAccountId: user.usersUid,
      destination: { operator: payload.providerCode, msisdn: payload.phone, country: 'ci' },
      feeContext: {
        serviceTypeCode: payload.serviceType,
        paymentMethodCode: payload.paymentMethodCode,
        providerFromCode: payload.providerCode,
        includeFees: payload.include_fees,
      },
      metadata: {
        paymentMethodCode: payload.paymentMethodCode,
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalOut(command)

    this.emitAudit(result, payload, user)

    const response: TransfertResponseDTO = {
      message: 'transfert initié',
      data: { transactionReference: result.reference, status: result.status },
    }

    if (idempotencyKey) {
      this.idempotency.update(idempotencyKey, JSON.stringify(response)).catch((err) => {
        transactionLog.warn(
          'IDEMPOTENCY_UPDATE_FAILED',
          { idempotencyKey, error: err instanceof Error ? err.message : 'Unknown' },
          'Non-critical: failed to update idempotency cache'
        )
      })
    }

    transactionLog.info(
      'TRANSFER_SUCCESS',
      {
        transaction: { id: result.movementId, reference: result.reference },
        user: { id: user.id },
        amount: result.amount,
      },
      'Transfer operation completed'
    )

    return response
  }

  /**
   * Émet l'événement d'audit produit du transfert (contexte requête : IP, user-agent, géo).
   * @private
   */
  private emitAudit(
    result: MovementResult,
    payload: TransfertRequestDto,
    user: OperationActor
  ): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'TRANSFER_INITIATED',
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
