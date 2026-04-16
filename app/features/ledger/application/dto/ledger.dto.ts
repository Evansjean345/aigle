import type Ledger from '#features/ledger/domain/models/ledger'
import { UserKycStatus } from '#features/user/domain/enum'

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
  userUid: string
}

export interface LedgerWalletDto {
  id: number
  user: LedgerUserDto
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

  static fromLedger(ledger: Ledger): LedgerDto {
    const transaction = ledger.transaction
    const wallet = ledger.wallet
    const user = wallet?.user

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
      user: {
        firstname: user?.firstname,
        lastname: user?.lastname,
        pictureUrl: user?.kycStatus === UserKycStatus.VERIFIED ? user?.pictureUrl || null : null,
        userUid: wallet?.userId,
      },
    }
    return dto
  }
}
