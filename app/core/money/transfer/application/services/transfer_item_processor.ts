import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'

/**
 * Politique de retry (payout) : backoff exponentiel **jitteré** et **plafonné**. Base courte — le
 * gouverneur digress rate-limite déjà Hub2, le backoff n'a pas à réguler le débit — et le **jitter
 * désynchronise** les retries d'un lot (anti *thundering herd* quand N items échouent au même tick).
 */
const RETRY_BASE_SECONDS = 2
const RETRY_MAX_DELAY_SECONDS = 300 // plafond du délai (5 min)
const MAX_ATTEMPTS = 6

/**
 * Unité d'exécution d'un item de mass-transfer (B4). Verrou idempotent `queued → sending`, puis
 * `engine.initiateExternalOut({ prefunded })` (B1 — pas de re-débit) :
 * - accepté (PENDING) → item `sent` (+ provider/transaction refs) ;
 * - erreur **retryable** (< MAX) → `queued` + `next_retry_at` (repris par le relais, **sans** release) ;
 * - erreur **définitive** ou MAX atteint → `failed` + **release** de la part (recrédit du hold).
 *
 * Le release au send-time est piloté **ici** (engine ne fait pas d'auto-reversal en prefunded) ;
 * le release au **webhook** (item déjà `sent`) passe par le settlement (B5). Toute la persistance
 * passe par les **repositories** (aucun accès model direct depuis le service).
 */
@inject()
export default class TransferItemProcessor {
  constructor(
    private readonly engine: MoneyMovementEngine,
    private readonly reservation: TransferReservationService,
    private readonly itemRepo: TransferItemRepository,
    private readonly batchRepo: TransferBatchRepository
  ) {}

  async process(itemId: number): Promise<void> {
    const locked = await this.itemRepo.lockForSending(itemId)
    if (!locked) return

    const item = await this.itemRepo.findById(itemId)
    if (!item) return

    const batch = await this.batchRepo.findById(item.batchId)
    if (!batch) return

    try {
      const result = await this.engine.initiateExternalOut(this.buildCommand(item, batch))

      await this.itemRepo.update(itemId, {
        status: TransferItemStatus.SENT,
        providerReference: result.providerReference ?? null,
        transactionReference: result.reference,
      })
    } catch (error) {
      await this.onFailure(item, batch, error)
    }
  }

  private buildCommand(item: TransferItem, batch: TransferBatch): ExternalOutCommand {
    return {
      idempotencyKey: item.idempotencyKey,
      amount: Number(item.amount),
      currency: item.currency,
      initiatedBy: batch.initiatedBy,
      type: TransactionType.TRANSFERT,
      fromAccountId: batch.accountId,
      destination: { operator: item.operator, msisdn: item.recipientPhone, country: item.country },
      feeContext: {
        serviceTypeCode: TransactionType.TRANSFERT,
        paymentMethodCode: 'mobile-money',
        providerFromCode: item.operator,
        includeFees: false,
      },
      prefunded: true,
      fees: Number(item.fees),
      metadata: { paymentMethodCode: 'mobile-money' },
    }
  }

  private async onFailure(item: TransferItem, batch: TransferBatch, error: unknown): Promise<void> {
    const attempts = item.attempts + 1
    const retryable = (error as { retryable?: boolean })?.retryable === true

    if (retryable && attempts < MAX_ATTEMPTS) {
      await this.itemRepo.update(item.id, {
        status: TransferItemStatus.QUEUED,
        attempts,
        nextRetryAt: DateTime.now().plus({ seconds: this.nextRetryDelay(attempts) }),
      })
      return
    }

    const trx = await db.transaction()

    try {
      await this.itemRepo.update(
        item.id,
        {
          status: TransferItemStatus.FAILED,
          attempts,
          failureReason: error instanceof Error ? error.message : 'send failed',
        },
        trx
      )

      await this.batchRepo.incrementSettlementCounter(item.batchId, 'failure', trx)
      // Échec d'item → sa part revient au client, frais compris (L2-D31), ventilée (L2-D36).
      await this.reservation.releaseHold(
        batch.accountId,
        Number(item.amount),
        item.idempotencyKey,
        trx,
        Number(item.fees)
      )
      await trx.commit()
    } catch (e) {
      if (!trx.isCompleted) await trx.rollback()
      throw e
    }
  }

  /**
   * Délai (s) avant le prochain essai : **full jitter** = `random(0, min (base·2^(n-1), plafond))',
   * avec un **plancher à 1 s** (pas de retry immédiat). Dispersion maximale → désynchronise au mieux
   * les retries d'un même lot (anti *thundering herd*) ; le gouverneur digress lisse de toute façon
   * le débit même si plusieurs items tirent un court délai. Exemples (base 2 s) : t1 ∈ [1,2] ·
   * t2 ∈ [1,4] · t3 ∈ [1,8] · t4 ∈ [1,16] · t5 ∈ [1,32].
   */
  private nextRetryDelay(attempts: number): number {
    const exp = Math.min(RETRY_BASE_SECONDS * 2 ** (attempts - 1), RETRY_MAX_DELAY_SECONDS)
    return Math.max(1, Math.round(exp * Math.random()))
  }
}
