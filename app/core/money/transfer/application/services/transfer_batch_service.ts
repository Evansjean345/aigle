import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import TransferReservationService from '#core/money/transfer/application/services/transfer_reservation_service'
import FeeResolver from '#core/money/money_movement/application/services/fee_resolver'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'
import type TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import type TransferItem from '#core/money/transfer/domain/models/transfer_item'
import type {
  InitiateMassTransferCommand,
  MassTransferResult,
  MassTransferSimulationResult,
} from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Orchestration d'un lot de paiement en masse (mass-transfer). Frontière core exposée au produit
 * (règle `produit-consomme-core-par-service').
 *
 * `initiate` : idempotence de requête → **réservation** du total (hold, option A) → **bulk-insert**
 * du lot avec N items ('queued'), dans **une** transaction DB courte, **sans**
 * appel réseau provider. Le drain (relais) et l'approbation viennent après (B4/B8).
 *
 * Frais : tarifés **par bénéficiaire** via la grille `transfert` (L2-D30) et **figés** sur
 * l'item (L2-D28) ; le hold couvre `Σ(montant + frais)'.
 */
@inject()
export default class TransferBatchService {
  constructor(
    private readonly batchRepo: TransferBatchRepository,
    private readonly itemRepo: TransferItemRepository,
    private readonly reservation: TransferReservationService,
    private readonly feeResolver: FeeResolver,
    private readonly walletService: WalletService
  ) {}

  /**
   * Frais de chaque bénéficiaire via la grille `transfert` (L2-D30) — la même qu'un transfert unique,
   * `includeFees : false` : les business paie **en plus** du montant, le bénéficiaire reçoit l'intégralité.
   *
   * Séquentiel et hors transaction DB : purement calculatoire, exécuté **avant** d'ouvrir la trx pour
   * ne pas tenir de verrous pendant la résolution. Une erreur remonte telle quelle → tout le lot est
   * rejeté (L2-D32).
   */
  private async resolveItemFees(
    recipients: InitiateMassTransferCommand['recipients']
  ): Promise<number[]> {
    const fees: number[] = []

    for (const recipient of recipients) {
      const result = await this.feeResolver.resolve(
        {
          serviceTypeCode: TransactionType.TRANSFERT,
          paymentMethodCode: 'mobile-money',
          providerFromCode: recipient.operator,
          includeFees: false,
        },
        Number(recipient.amount)
      )

      fees.push(Number(result.fees))
    }

    return fees
  }

  /**
   * Devis d'un lot **avant** initiation (B11) : ce qu'il coûtera et ce qu'il manque au compte.
   *
   * Réutilise **'resolveItemFees'**, la fonction qu'emploie `initiate` — le devis ne peut donc pas
   * diverger du débit réel (L2-D33). Un opérateur non tarifable échoue ici comme à l'initiation
   * (L2-D32) : la simulation sert alors de détecteur de trou de catalogue, avant d'engager quoi que
   * ce soit.
   *
   * **Lecture pure** : aucun lot, aucun item, aucun hold, aucune transaction DB — un marchand doit
   * pouvoir comparer des scénarios sans jamais immobiliser ses fonds.
   */
  async simulate(command: InitiateMassTransferCommand): Promise<MassTransferSimulationResult> {
    const { recipients } = command
    const itemFees = await this.resolveItemFees(recipients)

    const totalAmount = recipients.reduce((sum, r) => sum + Number(r.amount), 0)
    const fees = itemFees.reduce((sum, f) => sum + f, 0)
    const total = totalAmount + fees

    const wallet = await this.walletService.getByAccountId(command.accountId)
    const balance = Number(wallet.balance)

    return {
      expectedCount: recipients.length,
      currency: 'XOF',
      totalAmount,
      fees,
      total,
      balance,
      // Jamais négatif : au-delà du solde requis, il n'y a rien à approvisionner.
      shortfall: Math.max(0, total - balance),
    }
  }

  async initiate(command: InitiateMassTransferCommand): Promise<MassTransferResult> {
    // 1. Idempotence requête : rejeu du POST → renvoie le lot existant, ne re-réserve rien.
    if (command.idempotencyKey) {
      const existing = await this.batchRepo.findByIdempotencyKey(command.idempotencyKey)
      if (existing) return this.toResult(existing, true)
    }

    const { recipients } = command
    const itemFees = await this.resolveItemFees(recipients)

    const totalAmount = recipients.reduce((sum, r) => sum + Number(r.amount), 0)
    const fees = itemFees.reduce((sum, f) => sum + f, 0)
    const reference = this.generateReference()

    const trx = await db.transaction()

    try {
      // 2. RÉSERVE : débit gardé du total (lève InsufficientFunds → rollback, aucun lot créé).
      // Ventilé (L2-D36) : le principal et les frais sont réservés ensemble mais journalisés à part.
      const { reservationRef } = await this.reservation.hold(
        command.accountId,
        totalAmount,
        reference,
        trx,
        fees
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
        fees: itemFees[index],
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
