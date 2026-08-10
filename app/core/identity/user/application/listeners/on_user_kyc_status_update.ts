import { inject } from '@adonisjs/core'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus, KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import { UserKycStatus } from '#core/identity/user/domain/enum'
import UpdateUserKycStatus from '#core/identity/user/application/use_cases/update_user_kyc_status'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'

/**
 * Represents a handler for updates in KYC (Know Your Customer) status when a related event is triggered.
 */
@inject()
export default class OnUserKycStatusUpdate {
  /**
   * Constructor for initializing the class with necessary dependencies.
   *
   * @param {UpdateUserKycStatus} updateUserKycStatus - A service or function responsible for updating the user's KYC status.
   */
  constructor(private readonly updateUserKycStatus: UpdateUserKycStatus) {}

  /**
   * Reporte l'état d'un dossier de vérification sur le KYC de son porteur.
   *
   * N'agit que sur les dossiers d'utilisateur : une organisation n'a pas de KYC à mettre à jour.
   *
   * @param {KycDocumentSubmitted | KycDocumentProcessed} event - Soumission ou décision de revue.
   */
  async handle(event: KycDocumentSubmitted | KycDocumentProcessed) {
    if (event.ownerType !== AccountOwnerType.USER) return

    const userId = event.userId as string

    if (event instanceof KycDocumentSubmitted) {
      if (event.status === KycDocumentStatus.PENDING) {
        await this.updateUserKycStatus.execute(
          userId,
          UserKycStatus.PENDING_IN_REVIEW,
          undefined,
          undefined,
          {
            actorId: userId,
            actorType: 'User',
            ipAddress: event.auditContext?.ipAddress ?? null,
            userAgent: event.auditContext?.userAgent ?? null,
            requestId: event.auditContext?.requestId ?? null,
            geoLocation: event.auditContext?.geoLocation,
          }
        )
      }
    }

    if (event instanceof KycDocumentProcessed) {
      const newUserStatus =
        event.status === KycDocumentStatus.APPROVED
          ? UserKycStatus.VERIFIED
          : UserKycStatus.REJECTED

      const kycLevel =
        event.status === KycDocumentStatus.APPROVED ? KycLevelState.KYC_VERIFIED : undefined

      await this.updateUserKycStatus.execute(userId, newUserStatus, kycLevel, event.comment, {
        actorType: 'Admin',
        ipAddress: event.auditContext?.ipAddress ?? null,
        userAgent: event.auditContext?.userAgent ?? null,
        requestId: event.auditContext?.requestId ?? null,
        geoLocation: event.auditContext?.geoLocation,
      })
    }
  }
}
