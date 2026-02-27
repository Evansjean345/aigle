import Ledger from '#features/ledger/domain/models/ledger'
import { LedgerDto } from '#features/ledger/application/dto/ledger.dto'
import { UserKycStatus } from '#features/user/domain/enum'

export default class LedgerMapper {
  /**
   * Transforme un modèle Ledger en DTO LedgerDto.
   */
  static toDto(ledger: Ledger): LedgerDto {
    const transaction = ledger.transaction
    const wallet = ledger.wallet
    const user = wallet?.user

    return {
      id: ledger.id,
      direction: ledger.direction,
      operationType: ledger.operationType,
      description: ledger.description,
      amountBrut: Number(ledger.amountBrut).toFixed(4),
      fees: Number(ledger.fees).toFixed(4),
      totalAmount: Number(ledger.totalAmount).toFixed(4),
      balanceBefore: Number(ledger.balanceBefore).toFixed(4),
      balanceAfter: Number(ledger.balanceAfter).toFixed(4),
      createdAt: ledger.createdAt?.toISO() || '',
      transaction: {
        id: transaction?.id,
        reference: transaction?.reference,
        operationType: transaction?.operationType,
        status: transaction?.status,
        description: transaction?.description || null,
      },
      wallet: {
        id: wallet?.id,
        user: {
          firstname: user?.firstname,
          lastname: user?.lastname,
          pictureUrl: user?.kycStatus === UserKycStatus.VERIFIED ? user?.pictureUrl || null : null,
          userUid: wallet?.userId,
        },
      },
    }
  }

  /**
   * Transforme une liste de modèles Ledger en une liste de DTOs LedgerDto.
   */
  static toDtoList(ledgers: Ledger[]): LedgerDto[] {
    return ledgers.map((ledger) => this.toDto(ledger))
  }
}
