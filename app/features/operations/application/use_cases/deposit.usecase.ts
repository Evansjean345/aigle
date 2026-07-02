import {
  DepositRequestDto,
  DepositResponseDTO,
} from '#features/operations/application/dtos/operation.dto'
import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import Transaction from '#features/transactions/domain/models/transaction'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import AccountValidationService from '#features/user/application/services/account_validation_service'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import ServiceTypeRepository from '#features/catalogs/domain/interfaces/service_type_repository'
import DebitPhoneValidationService from '#features/operations/application/services/debit_phone_validation_service'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import MoneyMovementEngine from '#features/money_movement/domain/interfaces/money_movement_engine'
import type { ExternalInCommand } from '#features/money_movement/domain/types/money_movement_types'

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
    private readonly transactionService: TransactionService,
    private readonly serviceTypeRepository: ServiceTypeRepository,
    private readonly accountValidationService: AccountValidationService,
    private readonly failureCache: TransactionFailureCache,
    private readonly idempotency: IdempotencyProvider,
    private readonly debitPhoneValidationService: DebitPhoneValidationService,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: DepositRequestDto,
    user: User,
    idempotencyKey?: string
  ): Promise<DepositResponseDTO> {
    transactionLog.info(
      'DEPOSIT_START',
      { user: { id: user.id, uid: user.usersUid }, payload: { ...payload } },
      'Starting deposit process'
    )

    await Promise.all([
      this.failureCache.verifyNotBlocked(user.usersUid),
      this.accountValidationService.validateDevice(user, payload.deviceInfo, payload.geoIpLocation),
      this.debitPhoneValidationService.validateDebitPhone(payload.phone, payload.providerId, user),
    ])

    const serviceType = await this.serviceTypeRepository.findByCode(payload.serviceType)

    const command: ExternalInCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: user.usersUid,
      type: serviceType.code as TransactionType,
      toAccountId: user.usersUid,
      source: { operator: payload.providerCode, msisdn: payload.phone, country: 'ci' },
      feeContext: {
        serviceTypeId: serviceType.id,
        paymentMethodId: payload.paymentMethodId,
        providerFromId: payload.providerId,
      },
      metadata: {
        paymentMethodCode: payload.paymentMethodCode,
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalIn(command)

    const transaction = await this.transactionService.findByReference(result.reference)
    this.emitAudit(transaction, payload, user)

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
  private emitAudit(transaction: Transaction, payload: DepositRequestDto, user: User): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'DEPOSIT_INITIATED',
        actorId: String(user.id),
        actorType: 'User',
        targetType: 'Transaction',
        targetId: String(transaction.id),
        result: AuditResult.SUCCESS,
        ipAddress: payload.ipAddress ?? payload.geoIpLocation?.ip ?? null,
        userAgent: payload.userAgent ?? null,
        requestId: payload.requestId ?? null,
        metadata: {
          reference: transaction.reference,
          amount: transaction.amount,
          fees: transaction.fees,
          total: transaction.totalAmount,
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
