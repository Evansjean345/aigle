import type Ledger from '#core/money/ledger/domain/models/ledger'
import type { AccountHolderResult } from '#core/money/transactions/application/services/account_holder_resolver'

export class LedgerTransactionDto {
  declare id: number
  declare reference: string
  declare operationType: string
  declare status: string
  declare description: string | null
}

export interface LedgerUserDto {
  firstname: string
  lastname: string
  pictureUrl: string | null
  userUid: string | null
}

/**
 * Wallet d'une écriture — **titulaire uniforme** (account-centric) : `user` pour un compte
 * utilisateur, sinon `merchantName` (nom commercial résolu via l'alias payable) pour un compte
 * d'organisation. Aligné sur le `party` des transactions admin.
 */
export interface LedgerWalletDto {
  id: number
  accountId: string | null
  user: LedgerUserDto | null
  merchantName: string | null
}

export class LedgerDto {
  declare id: number
  declare direction: string
  declare operationType: string
  declare description: string | null
  declare amountBrut: string
  declare fees: string
  declare totalAmount: string
  declare balanceBefore: string
  declare balanceAfter: string
  declare createdAt: string
  declare transaction: LedgerTransactionDto
  declare wallet: LedgerWalletDto

  /**
   * @param holders Map `accountId → titulaire résolu` (`LedgerHolderResolver`) — le titulaire est
   *   résolu par **compte** (chaîne wallet → account → owner), plus par le FK hérité `user_id`.
   */
  static fromLedger(ledger: Ledger, holders?: Map<string, AccountHolderResult>): LedgerDto {
    const transaction = ledger.transaction
    const wallet = ledger.wallet
    const holder = wallet?.accountId ? holders?.get(wallet.accountId) : undefined

    const dto = new LedgerDto()
    dto.id = ledger.id
    dto.direction = ledger.direction
    dto.operationType = ledger.operationType
    dto.description = ledger.description
    dto.amountBrut = Number(ledger.amountBrut).toFixed(4)
    dto.fees = Number(ledger.fees).toFixed(4)
    dto.totalAmount = Number(ledger.totalAmount).toFixed(4)
    dto.balanceBefore = Number(ledger.balanceBefore).toFixed(4)
    dto.balanceAfter = Number(ledger.balanceAfter).toFixed(4)
    dto.createdAt = ledger.createdAt?.toISO() || ''
    dto.transaction = {
      id: transaction?.id,
      reference: transaction?.reference,
      operationType: transaction?.operationType,
      status: transaction?.status,
      description: transaction?.description || null,
    }
    dto.wallet = {
      id: wallet?.id,
      accountId: wallet?.accountId ?? null,
      user: holder?.user
        ? {
            firstname: holder.user.firstname ?? '',
            lastname: holder.user.lastname ?? '',
            pictureUrl: holder.user.pictureUrl,
            // Invariant β : accountId == usersUid pour un compte user.
            userUid: holder.user.userId,
          }
        : null,
      merchantName: holder?.merchantName ?? null,
    }
    return dto
  }
}
