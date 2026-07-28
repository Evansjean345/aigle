import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import TransferRelayJob from '#core/money/transfer/application/jobs/transfer_relay_job'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import TransferBatchNotFoundException from '#core/money/transfer/domain/exceptions/transfer_batch_not_found_exception'
import TransferBatchNotPendingApprovalException from '#core/money/transfer/domain/exceptions/transfer_batch_not_pending_approval_exception'
import SelfApprovalNotAllowedException from '#core/money/transfer/domain/exceptions/self_approval_not_allowed_exception'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'

/**
 * Maker-checker d'un lot de mass-transfer;
 * un **second** membre l'approuve ou le rejette.
 *
 * - **approve** : garde d'état + séparation → `queued` + **kick du relais** (démarre le drain).
 * - **reject** : garde d'état + séparation → `rejected` + **releaseHold** (recrédit du hold complet).
 *
 * Concurrence : le lot est chargé **`FOR UPDATE`** → deux actions concurrentes se sérialisent, la
 * seconde voit un statut ≠ `pending_approval` → **409** (idempotent).
 *
 * Séparation des tâches : approbateur ≠ initiateur, **sauf** OWNER (déterminé côté produit et passé
 * en `approverIsOwner` — le core ne connaît pas les rôles d'org).
 */
@inject()
export default class TransferApprovalService {
  constructor(
    private readonly batchRepo: TransferBatchRepository,
    private readonly reservation: TransferReservationService
  ) {}

  async approve(reference: string, approverUid: string, approverIsOwner: boolean): Promise<void> {
    const trx = await db.transaction()

    try {
      const batch = await this.batchRepo.findByReferenceForUpdate(reference, trx)
      this.assertApprovable(batch, approverUid, approverIsOwner)

      await this.batchRepo.update(
        batch.id,
        { status: TransferBatchStatus.QUEUED, approvedBy: approverUid },
        trx
      )
      await trx.commit()
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }

    await TransferRelayJob.dispatch({})
  }

  async reject(
    reference: string,
    approverUid: string,
    approverIsOwner: boolean,
    reason?: string
  ): Promise<void> {
    const trx = await db.transaction()

    try {
      const batch = await this.batchRepo.findByReferenceForUpdate(reference, trx)
      this.assertApprovable(batch, approverUid, approverIsOwner)

      await this.batchRepo.update(
        batch.id,
        {
          status: TransferBatchStatus.REJECTED,
          approvedBy: approverUid,
          description: reason ?? batch.description,
        },
        trx
      )

      await this.reservation.releaseHold(
        batch.accountId,
        Number(batch.totalAmount) + Number(batch.fees),
        batch.reference,
        trx
      )
      await trx.commit()
    } catch (error) {
      if (!trx.isCompleted) await trx.rollback()
      throw error
    }
  }

  private assertApprovable(
    batch: TransferBatch | null,
    approverUid: string,
    approverIsOwner: boolean
  ): asserts batch is TransferBatch {
    if (!batch) throw new TransferBatchNotFoundException()

    if (batch.status !== TransferBatchStatus.PENDING_APPROVAL) {
      throw new TransferBatchNotPendingApprovalException()
    }

    if (approverUid === batch.initiatedBy && !approverIsOwner) {
      throw new SelfApprovalNotAllowedException()
    }
  }
}
