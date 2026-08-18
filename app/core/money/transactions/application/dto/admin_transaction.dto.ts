import { type DateTime } from 'luxon'
import { type TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#core/money/transactions/application/dto/payment.dto'
import TransactionDisplayService, {
  type TransactionDisplay,
  type PaymentDetailsInput,
} from '#core/money/transactions/application/services/transaction_display_service'
import type { AccountHolderResult } from '#core/money/transactions/application/dtos/account_holder.dto'
import type Transaction from '#core/money/transactions/domain/models/transaction'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export class AdminTransactionResponseDTO {
  declare id: number
  declare transactionUid: string
  declare reference: string
  declare amount: number
  declare fees: number
  declare totalAmount: number
  declare operationType: string
  declare direction: TransactionDirection
  declare status: string
  declare description: string | null
  declare createdAt: DateTime
  declare updatedAt: DateTime
  declare payment: PaymentResponseDTO[]
  /**
   * Partie prenante de la transaction : un compte utilisateur, nom et lien vers son profil, ou un
   * compte d'organisation, nommé par son alias payable.
   *
   * Le core ne distingue pas un marchand d'une entreprise — le type de compte vit dans le produit.
   */
  declare party?: {
    accountId: string
    type: 'user' | 'organisation' | 'unknown'
    name: string | null
    /** Présent uniquement pour un compte user (lien vers le profil admin). */
    userId?: string
    /** Wallet du compte user (préchargé en détails) — pour l'ajustement admin. Absent en liste. */
    wallet?: {
      id: number
      balance: number
    }
  }
  /**
   * Classification d'affichage dérivée (taxonomie 2026-07), **partagée avec le mobile** : `kind`
   * (encaissement / paiement marchand / P2P / dépôt / transfert externe / inter-réseau…), `scope`,
   * `flow` et `counterparty`. Complète `party` (le **titulaire** du leg) par la **contrepartie** du
   * flux — côté admin le libellé s'appuie sur le numéro brut (pas de résolution de contact).
   */
  declare display: TransactionDisplay
  declare ledgers?: {
    id: number
    walletId: number
    walletLabel?: string
    walletCurrencySymbol?: string
    direction: string
    operationType: string
    amountBrut: number
    fees: number
    totalAmount: number
    balanceAfter: number
    balanceBefore: number
    createdAt: DateTime
  }[]
  declare securityContext?: {
    ipAddress: string
    deviceId: string | null
    deviceUuid: string | null
    userAgent: string | null
    osVersion: string | null
    appVersion: string | null
    countryCode: string | null
    city: string | null
    isVpn: boolean
    riskScore: number | null
    capturedAt: DateTime
  }
  declare logs?: {
    id: number
    eventType: string
    status: string
    errorMessage: string | null
    ipAddress: string | null
    actorId: string | null
    actorType: string | null
    createdAt: DateTime
  }[]
  declare refund?: {
    id: number
    refundUid: string
    walletId: number
    type: string
    reason: string
    status: string
    amount: number
    feesRefunded: number
    totalRefunded: number
    comment: string
    adminId: number | null
    admin: {
      id: number
      firstname: string
      lastname: string
      email: string
    } | null
    balanceBefore: number
    balanceAfter: number
    executedAt: DateTime
    createdAt: DateTime
  } | null

  /**
   * @param transaction La transaction.
   * @param holders Map `accountId → titulaire résolu` (`AccountHolderResolver`) — le titulaire est
   *   résolu par **compte** (account-centric), plus par la relation `user` préchargée.
   * @param wallet Wallet du compte (id + solde), résolu par `account_id` en vue détails — pour
   *   l'ajustement admin. Absent en liste.
   */
  static fromTransaction(
    transaction: Transaction,
    holders?: Map<string, AccountHolderResult>,
    wallet?: { id: number; balance: number }
  ): AdminTransactionResponseDTO {
    const dto = new AdminTransactionResponseDTO()

    let paymentResponse: PaymentResponseDTO[] = []
    if (transaction.payment && transaction.payment.length > 0) {
      paymentResponse = transaction.payment.map(PaymentResponseDTO.fromPaymentAdmin)
    }

    dto.id = transaction.id
    dto.transactionUid = transaction.transactionsUid
    dto.reference = transaction.reference
    dto.amount = transaction.amount
    dto.fees = transaction.fees
    dto.totalAmount = transaction.totalAmount
    dto.operationType = transaction.operationType
    dto.direction = transaction.direction
    dto.status = transaction.status
    dto.description = transaction.description
    dto.createdAt = transaction.createdAt
    dto.updatedAt = transaction.updatedAt
    dto.payment = paymentResponse
    dto.display = TransactionDisplayService.toDisplay({
      operationType: transaction.operationType,
      direction: transaction.direction,
      paymentDetails: transaction.payment?.[0]
        ?.paymentDetails as unknown as PaymentDetailsInput | null,
      description: transaction.description,
    })
    const holder = holders?.get(transaction.accountId)
    if (holder?.user) {
      const fullName = `${holder.user.firstname ?? ''} ${holder.user.lastname ?? ''}`.trim()
      dto.party = {
        accountId: transaction.accountId,
        type: 'user',
        name: fullName || null,
        userId: holder.user.userId,
        wallet,
      }
    } else {
      dto.party = {
        accountId: transaction.accountId,
        type: holder?.merchantName ? 'organisation' : 'unknown',
        name: holder?.merchantName ?? null,
        wallet,
      }
    }
    dto.ledgers = transaction.ledgers?.length
      ? transaction.ledgers.map((ledger) => ({
          id: ledger.id,
          walletId: ledger.walletId,
          walletCurrencySymbol: (ledger.wallet as any)?.currencySymbol,
          direction: ledger.direction,
          operationType: ledger.operationType,
          amountBrut: ledger.amountBrut,
          fees: ledger.fees,
          totalAmount: ledger.totalAmount,
          balanceAfter: ledger.balanceAfter,
          balanceBefore: ledger.balanceBefore,
          createdAt: ledger.createdAt,
        }))
      : undefined
    dto.securityContext = transaction.securityContext
      ? {
          ipAddress: transaction.securityContext.ipAddress,
          // `device` peut être null : une transaction initiée sans appareil lié (ex. payout business
          // en canal web, device vide) a un securityContext SANS Device → garde optionnelle.
          deviceId: transaction.securityContext.device?.id ?? null,
          deviceUuid: transaction.securityContext.device?.deviceUid ?? null,
          userAgent: transaction.securityContext.userAgent,
          osVersion: transaction.securityContext.osVersion,
          appVersion: transaction.securityContext.appVersion,
          countryCode: transaction.securityContext.countryCode,
          city: transaction.securityContext.city,
          isVpn: transaction.securityContext.isVpn,
          riskScore: transaction.securityContext.riskScore,
          capturedAt: transaction.securityContext.capturedAt,
        }
      : undefined
    dto.logs = transaction.logs?.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      status: log.status,
      errorMessage: log.errorMessage,
      ipAddress: log.ipAddress,
      actorId: log.actorId,
      actorType: log.actorType,
      createdAt: log.createdAt,
    }))
    dto.refund = transaction.refund
      ? {
          id: transaction.refund.id,
          refundUid: transaction.refund.refundUid,
          walletId: transaction.refund.walletId,
          type: transaction.refund.type,
          reason: transaction.refund.reason,
          status: transaction.refund.status,
          amount: Number(transaction.refund.amount),
          feesRefunded: Number(transaction.refund.feesRefunded),
          totalRefunded: Number(transaction.refund.totalRefunded),
          comment: transaction.refund.comment,
          adminId: transaction.refund.adminId,
          admin: transaction.refund.admin
            ? {
                id: transaction.refund.admin.id,
                firstname: transaction.refund.admin.firstname,
                lastname: transaction.refund.admin.lastname,
                email: transaction.refund.admin.email,
              }
            : null,
          balanceBefore: Number(transaction.refund.balanceBefore),
          balanceAfter: Number(transaction.refund.balanceAfter),
          executedAt: transaction.refund.executedAt,
          createdAt: transaction.refund.createdAt,
        }
      : null

    return dto
  }

  static async fromPaginator(
    paginatedTransactions: ModelPaginatorContract<Transaction>,
    holders?: Map<string, AccountHolderResult>
  ): Promise<PaginatedAdminTransactionsResponseDTO> {
    const items = paginatedTransactions.all()
    return {
      data: items.map((t) => AdminTransactionResponseDTO.fromTransaction(t, holders)),
      meta: {
        total: paginatedTransactions.total,
        currentPage: paginatedTransactions.currentPage,
        firstPage: paginatedTransactions.firstPage,
        lastPage: paginatedTransactions.lastPage,
        perPage: paginatedTransactions.perPage,
      },
    }
  }
}

export class PaginationMeta {
  declare total: number
  declare currentPage: number
  declare lastPage: number
  declare firstPage: number
  declare perPage: number
}

export interface PaginatedAdminTransactionsResponseDTO {
  data: AdminTransactionResponseDTO[]
  meta: PaginationMeta
}

export class UserTransactionsStatsDTO {
  declare totalInVolume: number
  declare totalOutVolume: number
  declare transferVolume: number
  declare interNetworkVolume: number
  declare walletTransferVolume: number
  declare totalFees: number
  declare avgTransactionValue: number
  declare successRate: number
  declare failureRate: number
  declare successCount: number
  declare failedCount: number
  declare pendingCount: number
  declare totalCount: number
}
