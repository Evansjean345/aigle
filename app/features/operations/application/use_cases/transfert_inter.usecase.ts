import {
  InterTransfertRequestDto,
  InterTransfertResponseDTO,
} from '#features/operations/application/dtos/transfert_inter.dto'
import { inject } from '@adonisjs/core'
import User from '#core/user/domain/models/user'
import { TransactionType } from '#core/transactions/domain/enums/transaction_type'
import IdempotencyProvider from '#core/transactions/domain/interfaces/idempotency_provider'
import IdentityGate from '#core/authentication/application/services/identity_gate'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import MoneyMovementEngine from '#core/money_movement/domain/interfaces/money_movement_engine'
import type {
  ExternalToExternalCommand,
  MovementResult,
} from '#core/money_movement/domain/types/money_movement_types'

/**
 * Use case transfert_inter — routeur mince (Lot 2, L2-D6).
 *
 * Gardes produit (blocage, throttle, appareil, téléphone débiteur) → mapping payload →
 * `ExternalToExternalCommand` → `engine.initiateExternalToExternal` → audit + réponse. Les records
 * (transaction EXTERNAL + 2 payments), l'absence de mouvement wallet et l'initiation de la jambe 1
 * vivent dans le core. La jambe 2 (webhook) est inchangée au Lot 2.
 */
@inject()
export default class InterTransfertUseCase {
  constructor(
    private readonly identityGate: IdentityGate,
    private readonly idempotency: IdempotencyProvider,
    private readonly engine: MoneyMovementEngine
  ) {}

  async execute(
    payload: InterTransfertRequestDto,
    user: User,
    idempotencyKey?: string
  ): Promise<InterTransfertResponseDTO> {
    transactionLog.info(
      'INTER_TRANSFER_START',
      {
        user: { id: user.id, uid: user.usersUid },
        payload: { ...payload, pinCode: payload.pinCode ? '****' : undefined },
      },
      'Starting inter-network transfer process'
    )

    await this.identityGate.authorize({
      user,
      kind: 'transfert_inter',
      deviceInfo: payload.deviceInfo,
      geoIpLocation: payload.geoIpLocation,
      debitPhone: { phone: payload.debiteurPhone, providerId: payload.providerFromId },
    })

    const command: ExternalToExternalCommand = {
      idempotencyKey: idempotencyKey ?? '',
      amount: Number(payload.amount),
      currency: 'XOF',
      initiatedBy: user.usersUid,
      type: payload.serviceType as TransactionType,
      source: { operator: payload.providerFromCode, msisdn: payload.debiteurPhone, country: 'ci' },
      destination: {
        operator: payload.providerToCode,
        msisdn: payload.beneficiairePhone,
        country: 'ci',
      },
      feeContext: {
        serviceTypeCode: payload.serviceType,
        paymentMethodCode: payload.paymentMethodDepositCode,
        providerFromCode: payload.providerFromCode,
        providerToCode: payload.providerToCode,
        includeFees: payload.includeFees,
      },
      metadata: {
        paymentMethodDepositCode: payload.paymentMethodDepositCode,
        paymentMethodTransfertCode: payload.paymentMethodTransfertCode,
        pinCode: payload.pinCode,
        deviceInfo: payload.deviceInfo,
        geoIpLocation: payload.geoIpLocation,
      },
    }

    const result = await this.engine.initiateExternalToExternal(command)

    this.emitAudit(result, payload, user)

    const response: InterTransfertResponseDTO = {
      message: 'Initialisation du dépot inter effectuée',
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
          'INTER_TRANSFER_IDEMPOTENCY_UPDATE_FAILED',
          { transaction: { reference: result.reference }, error: error.message },
          'Failed to update idempotency cache for inter-transfer'
        )
      })
    }

    return response
  }

  /**
   * Émet l'événement d'audit produit du transfert inter-réseaux (contexte requête).
   * @private
   */
  private emitAudit(result: MovementResult, payload: InterTransfertRequestDto, user: User): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'INTER_TRANSFER_INITIATED',
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
          providerFrom: payload.providerFromCode,
          providerTo: payload.providerToCode,
          paymentMethodDeposit: payload.paymentMethodDepositCode,
          paymentMethodTransfert: payload.paymentMethodTransfertCode,
          geoCountry: payload.geoIpLocation?.countryCode ?? null,
          geoCity: payload.geoIpLocation?.city ?? null,
          isVpn: payload.geoIpLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
  }
}
