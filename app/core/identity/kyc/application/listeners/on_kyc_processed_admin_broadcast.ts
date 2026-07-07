import { inject } from '@adonisjs/core'
import transmit from '@adonisjs/transmit/services/main'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import errorLog from '#shared/infrastructure/logging/error_log'

/**
 * Keeps the live pending queue counter in sync for all agents currently
 * connected to the admin dashboard whenever a case is approved or rejected.
 */
@inject()
export default class OnKycProcessedAdminBroadcast {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  async handle(event: KycDocumentProcessed) {
    try {
      const pendingCount = await this.kycDocumentRepository.countByStatus(KycDocumentStatus.PENDING)

      transmit.broadcast('admin/kyc/queue', {
        type: 'kyc.processed',
        status: event.status,
        pendingCount,
        processedAt: new Date().toISOString(),
      })
    } catch (error) {
      errorLog.error(
        'KYC_BROADCAST_ERROR',
        { user_id: event.userId, error: (error as Error).message },
        'Failed to broadcast KYC processing to admin channel'
      )
    }
  }
}
