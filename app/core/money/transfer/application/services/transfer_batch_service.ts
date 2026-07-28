import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type {
  InitiateMassTransferCommand,
  MassTransferResult,
} from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Orchestration d'un lot de paiement en masse (mass-transfer). Frontière core exposée au produit
 * (règle `produit-consomme-core-par-service`).
 *
 * `initiate` (B3) : idempotence de requête → **réservation** du total (hold, option A) → **bulk-insert**
 * du lot (`pending_approval` — L2-D20) + N items (`queued`), dans **une** transaction DB courte, **sans**
 * appel réseau provider. Le drain (relais) et l'approbation viennent après (B4/B8).
 *
 * Frais = 0 au B3 (L2-D7) ; B10 câblera `FeeResolver` et le hold deviendra `Σ(montant + frais)`.
 */
@inject()
export default class TransferBatchService {
  constructor(
    private readonly batchRepo: TransferBatchRepository,
    private readonly itemRepo: TransferItemRepository,
    private readonly reservation: TransferReservationService
  ) {}

  async initiate(command: InitiateMassTransferCommand): Promise<MassTransferResult> {
    // 1. Idempotence requête : rejeu du POST → renvoie le lot existant, ne re-réserve rien.
    if (command.idempotencyKey) {
      const existing = await this.batchRepo.findByIdempotencyKey(command.idempotencyKey)
      if (existing) return this.toResult(existing, true)
    }

    const { recipients } = command
    const totalAmount = recipients.reduce((sum, r) => sum + Number(r.amount), 0)
    const fees = 0
    const total = totalAmount + fees
    const reference = this.generateReference()

    const trx = await db.transaction()

    try {
      // 2. RÉSERVE : débit gardé du total (lève InsufficientFunds → rollback, aucun lot créé).
      const { reservationRef } = await this.reservation.hold(
        command.accountId,
        total,
        reference,
        trx
      )

      // 3. Lot `pending_approval` + N items `queued` (bulk-insert).
      const batch = await this.batchRepo.create(
        {
          reference,
          accountId: command.accountId,
          initiatedBy: command.initiatedBy,
          label: command.label ?? null,
          description: command.description ?? null,
          totalAmount,
          fees,
          currency: 'XOF',
          expectedCount: recipients.length,
          successfulCount: 0,
          failedCount: 0,
          status: TransferBatchStatus.PENDING_APPROVAL,
          idempotencyKey: command.idempotencyKey ?? null,
          reservationRef,
        },
        trx
      )

      const rows: Partial<TransferItem>[] = recipients.map((r, index) => ({
        batchId: batch.id,
        idempotencyKey: `${batch.id}:${index}`,
        sequence: index,
        amount: Number(r.amount),
        fees: 0,
        currency: 'XOF',
        recipientName: r.name ?? null,
        recipientPhone: r.phone,
        operator: r.operator,
        country: r.country ?? 'ci',
        status: TransferItemStatus.QUEUED,
      }))
      await this.itemRepo.createMany(rows, trx)

      await trx.commit()
      return this.toResult(batch, false)
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  private toResult(batch: TransferBatch, alreadyExisted: boolean): MassTransferResult {
    return {
      reference: batch.reference,
      status: batch.status,
      expectedCount: batch.expectedCount,
      totalAmount: Number(batch.totalAmount),
      fees: Number(batch.fees),
      alreadyExisted,
    }
  }

  private generateReference(): string {
    return `transfer_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  }
}
