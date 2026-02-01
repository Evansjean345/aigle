import KycDocument from '#features/kyc/domain/models/kyc_document'
import { AdminKycListDto } from '#features/kyc/application/dto/kyc.dto'

export default class KycMapper {
  static toAdminDto(kyc: KycDocument): AdminKycListDto {
    return {
      id: kyc.id,
      userId: kyc.userId,
      documentType: kyc.documentType,
      documentRectoUrl: kyc.documentRectoUrl,
      documentVersoUrl: kyc.documentVersoUrl,
      selfieUrl: kyc.selfieUrl,
      status: kyc.status,
      comment: kyc.comment,
      createdAt: kyc.createdAt?.toISO() || kyc.createdAt?.toString() || '',
      attempts: kyc.attempts?.map((attempt) => attempt.toJSON()),
      user: kyc.user && {
        firstname: kyc.user.firstname,
        lastname: kyc.user.lastname,
        usersUid: kyc.user.usersUid,
        kycLevel: kyc.user.kycLevel,
        kycStatus: kyc.user.kycStatus,
        phone: kyc.user.phone,
        status: kyc.user.status,
        wallet: kyc.user.wallet && {
          id: kyc.user.wallet.id,
          balance: kyc.user.wallet.balance,
        },
      },
    }
  }

  static toAdminDtoList(kycs: KycDocument[]): AdminKycListDto[] {
    return kycs.map((kyc) => this.toAdminDto(kyc))
  }
}
