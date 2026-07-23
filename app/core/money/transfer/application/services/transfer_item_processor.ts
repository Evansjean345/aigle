import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'

/** Politique de retry serrée (payout) — L2-D12 : base 30 s, backoff exponentiel, MAX ~6. */
const RETRY_BASE_SECONDS = 30
const MAX_ATTEMPTS = 6

/**
 * Unité d'exécution d'un item de mass-transfer (B4). Verrou idempotent `queued → sending`, puis
 * `engine.initiateExternalOut({ prefunded })` (B1 — pas de re-débit) :
 * - accepté (PENDING) → item `sent` (+ provider/transaction refs) ;
 * - erreur **retryable** (< MAX) → `queued` + `next_retry_at` (repris par le relais, **sans** release) ;
 * - erreur **définitive** ou MAX atteint → `failed` + **release** de la part (recrédit du hold).
 *
 * Le release au send-time est piloté **ici** (l'engine ne fait pas d'auto-reversal en prefunded) ;
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
    // Verrou idempotent : seul un item `queued` est pris ; sinon (terminal / déjà pris) → skip.
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
      metadata: { paymentMethodCode: 'mobile-money' },
    }
  }

  private async onFailure(item: TransferItem, batch: TransferBatch, error: unknown): Promise<void> {
    const attempts = item.attempts + 1
    const retryable = (error as { retryable?: boolean })?.retryable === true

    if (retryable && attempts < MAX_ATTEMPTS) {
      // Retryable : on garde le hold, on replanifie (repris par le relais). PAS de release.
      await this.itemRepo.update(item.id, {
        status: TransferItemStatus.QUEUED,
        attempts,
        nextRetryAt: DateTime.now().plus({ seconds: RETRY_BASE_SECONDS * 2 ** (attempts - 1) }),
      })
      return
    }

    // Définitif (ou dead letter après MAX) : item `failed` + release de la part (recrédit du hold).
    await this.itemRepo.update(item.id, {
      status: TransferItemStatus.FAILED,
      attempts,
      failureReason: error instanceof Error ? error.message : 'send failed',
    })

    await this.reservation.releaseHold(
      batch.accountId,
      Number(item.amount) + Number(item.fees),
      item.idempotencyKey
    )
  }
}
