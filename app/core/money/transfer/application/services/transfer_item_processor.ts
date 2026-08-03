import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import MoneyMovementEngine from '#core/money/money_movement/domain/interfaces/money_movement_engine'
import AccountOperationalGuard from '#core/money/transfer/domain/interfaces/account_operational_guard'
import AccountBlockedException from '#core/money/money_movement/domain/exceptions/account_blocked_exception'
import WalletInactiveException from '#core/money/wallet/domain/exceptions/wallet_inactive_exception'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type { ExternalOutCommand } from '#core/money/money_movement/domain/types/money_movement_types'

/** Politique de retry : backoff exponentiel, jitteré et plafonné. */
const RETRY_BASE_SECONDS = 2
const RETRY_MAX_DELAY_SECONDS = 300 // plafond du délai (5 min)
const MAX_ATTEMPTS = 6

/** Délai avant de re-tester un compte devenu inopérant. Le lot reprend seul une fois rétabli. */
const SUSPENDED_RECHECK_SECONDS = 300

/**
 * Unité d'exécution d'un item de paiement en masse.
 *
 * Verrou idempotent `queued → sending', puis `engine.initiateExternalOut({ prefunded })` — sans
 * re-débit, le montant étant déjà réservé :
 * - accepté → item `sent', avec les références provider et transaction ;
 * - compte émetteur inopérant → `queued` différé, sans tentative consommée ni release ;
 * - erreur retryable sous le maximum → `queued` + `next_retry_at', sans release ;
 * - erreur définitive ou maximum atteint → `failed` + release de la part.
 *
 * Le release à l'envoi est piloté ici ; celui du webhook, sur un item déjà `sent', passe par le
 * settlement. Toute la persistance passe par les repositories.
 */
@inject()
export default class TransferItemProcessor {
  constructor(
    private readonly engine: MoneyMovementEngine,
    private readonly reservation: TransferReservationService,
    private readonly itemRepo: TransferItemRepository,
    private readonly batchRepo: TransferBatchRepository,
    private readonly accountGuard: AccountOperationalGuard
  ) {}

  /**
   * Traite un item : envoi, retry ou suspension.
   *
   * @param {number} itemId - Item à traiter.
   */
  async process(itemId: number): Promise<void> {
    const locked = await this.itemRepo.lockForSending(itemId)
    if (!locked) return

    const item = await this.itemRepo.findById(itemId)
    if (!item) return

    const batch = await this.batchRepo.findById(item.batchId)
    if (!batch) return

    if (await this.isSuspended(item, batch)) return

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

  /**
   * Remet l'item en attente quand le compte émetteur est bloqué ou son portefeuille gelé.
   *
   * L'un ou l'autre a pu survenir après l'approbation du lot. L'item repart en `queued` sans
   * consommer de tentative et sans release : le hold est conservé, et le lot reprend de lui-même
   * une fois le compte rétabli.
   *
   * Les autres erreurs remontent : elles suivent le traitement d'échec, qui finit par rendre la
   * part au client. Seuls ces deux états sont réversibles et justifient une attente.
   *
   * @param {TransferItem} item - Item verrouillé pour envoi.
   * @param {TransferBatch} batch - Lot auquel il appartient.
   * @returns {Promise<boolean>} `true` si l'item a été suspendu, `false` s'il peut partir.
   */
  private async isSuspended(item: TransferItem, batch: TransferBatch): Promise<boolean> {
    try {
      await this.accountGuard.assertOperational(batch.accountId)
      return false
    } catch (error) {
      const reversible =
        error instanceof AccountBlockedException || error instanceof WalletInactiveException

      if (!reversible) throw error

      await this.itemRepo.update(item.id, {
        status: TransferItemStatus.QUEUED,
        nextRetryAt: DateTime.now().plus({ seconds: SUSPENDED_RECHECK_SECONDS }),
      })

      return true
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
      // Échec d'item : sa part revient au client, frais compris.
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
   * Délai avant le prochain essai : `random(1, min(base·2^(n-1), plafond))`.
   *
   * Le tirage aléatoire désynchronise les retries d'un même lot ; le plancher à 1 s évite un retry
   * immédiat.
   *
   * @param {number} attempts - Tentatives déjà consommées.
   * @returns {number} Délai en secondes.
   */
  private nextRetryDelay(attempts: number): number {
    const exp = Math.min(RETRY_BASE_SECONDS * 2 ** (attempts - 1), RETRY_MAX_DELAY_SECONDS)
    return Math.max(1, Math.round(exp * Math.random()))
  }
}
