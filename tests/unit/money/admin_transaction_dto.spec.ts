import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { AdminTransactionResponseDTO } from '#core/money/transactions/application/dto/admin_transaction.dto'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import type Transaction from '#core/money/transactions/domain/models/transaction'

/**
 * Régression : le détail admin d'une transaction dont le `securityContext` **n'a pas d'appareil lié**
 * (ex. transfert business initié en canal web, `device` vide → aucun Device) plantait sur
 * `securityContext.device.id` (« Cannot read properties of null (reading 'id') »). Le mapping doit
 * garder `device` optionnel et renvoyer `deviceId`/`deviceUuid` à `null`.
 */

function payoutTx(): Transaction {
  return {
    id: 1,
    transactionsUid: 'uid-1',
    reference: 'aigle_trf_1',
    amount: 5000,
    fees: 0,
    totalAmount: 5000,
    operationType: TransactionType.TRANSFERT,
    direction: TransactionDirection.DEBIT,
    status: TransactionStatus.PENDING,
    description: null,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
    accountId: 'org-42',
    payment: [],
    logs: [],
    // securityContext présent MAIS sans appareil lié (device null).
    securityContext: {
      ipAddress: '127.0.0.1',
      device: null,
      userAgent: null,
      osVersion: null,
      appVersion: null,
      countryCode: null,
      city: null,
      isVpn: false,
      riskScore: null,
      capturedAt: DateTime.now(),
    },
    refund: null,
  } as unknown as Transaction
}

test.group('AdminTransactionResponseDTO | securityContext sans appareil', () => {
  test('device null → pas de crash, deviceId/deviceUuid = null', ({ assert }) => {
    const dto = AdminTransactionResponseDTO.fromTransaction(payoutTx())

    assert.isDefined(dto.securityContext)
    assert.isNull(dto.securityContext!.deviceId)
    assert.isNull(dto.securityContext!.deviceUuid)
    assert.equal(dto.securityContext!.ipAddress, '127.0.0.1')
  })
})
