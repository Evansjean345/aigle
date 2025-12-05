import { inject } from '@adonisjs/core'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import { UserKycStatus } from '#features/user/domain/enum'
import UpdateUserKycStatus from '#features/user/application/use_cases/update_user_kyc_status'

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
   * Handles the event when a KYC document is submitted for review.
   * Updates the user's KYC status to PENDING_IN_REVIEW if the document status is PENDING.'
   * @param event
   */
  async handle(event: KycDocumentSubmitted) {
    if (event.status === KycDocumentStatus.PENDING) {
      await this.updateUserKycStatus.execute(event.userId, UserKycStatus.PENDING_IN_REVIEW)
    }
  }
}
