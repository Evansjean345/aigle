import { inject } from '@adonisjs/core'
import transmit from '@adonisjs/transmit/services/main'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import errorLog from '#shared/infrastructure/logging/error_log'

/**
 * Notifies connected admin agents in real time when a new KYC document is
 * submitted by a user. The payload is intentionally minimal (no PII, no URLs)
 * — agents click on the dashboard and fetch the full record via the
 * authenticated admin API.
 */
@inject()
export default class OnKycSubmittedAdminBroadcast {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  async handle(event: KycDocumentSubmitted) {
    try {
      const pendingCount = await this.kycDocumentRepository.countByStatus(KycDocumentStatus.PENDING)

      transmit.broadcast('admin/kyc/queue', {
        type: 'kyc.submitted',
        pendingCount,
        submittedAt: new Date().toISOString(),
      })
    } catch (error) {
      errorLog.error(
        'KYC_BROADCAST_ERROR',
        { user_id: event.userId, error: (error as Error).message },
        'Failed to broadcast KYC submission to admin channel'
      )
    }
  }
}
