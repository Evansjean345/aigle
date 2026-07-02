import {
  TransfertRequestDto,
  TransfertResponseDTO,
} from '#features/operations/application/dtos/operation.dto'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#features/user/domain/models/user'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import TransactionThrottleCache from '#features/transactions/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalOutCommand,
  MovementResult,
} from '#features/money_movement/domain/types/money_movement_types'

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
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly accountValidationService: AccountValidationService,
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: TransfertRequestDto,
    user: User,
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

    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.throttleCache.verifyThrottle(user.usersUid),
      this.accountValidationService.validateDevice(user, payload.deviceInfo, payload.geoIpLocation),
      this.accountValidationService.verifyPinForUser(user, payload.pinCode!),
    ])

    const serviceType = await this.serviceTypeRepository.findByCode(payload.serviceType)

    if (!serviceType) {
      throw new Exception(`Service type ${payload.serviceType} not found`, {
        code: 'SERVICE_TYPE_NOT_FOUND',
        status: 404,
      })
    }

    const command: ExternalOutCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: user.usersUid,
      type: serviceType.code as TransactionType,
      fromAccountId: user.usersUid,
      destination: { operator: payload.providerCode, msisdn: payload.phone, country: 'ci' },
      feeContext: {
        serviceTypeId: serviceType.id,
        paymentMethodId: payload.paymentMethodId,
        providerFromId: payload.providerId,
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
  private emitAudit(result: MovementResult, payload: TransfertRequestDto, user: User): void {
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
