import type KycDocumentRepository from '#features/kyc/domain/interfaces/kyc_document_repository'
import KycDocument from '#features/kyc/domain/models/kyc_document'
import { KycDocumentStatus, KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import db from '@adonisjs/lucid/services/db'
import { KycAttemp } from '#features/kyc/domain/models/kyc_attemp'

/**
 * An implementation of the `KycDocumentRepository` interface that provides methods
 * for interacting with KYC (Know Your Customer) documents in the database.
 */
export default class KycDocumentRepositoryImpl implements KycDocumentRepository {
  /**
   * Retrieves the KYC (Know Your Customer) document associated with a specific user.
   *
   * @param {string} userId - The unique identifier of the user whose KYC document is to be retrieved.
   * @return {Promise<KycDocument | null>} A promise that resolves to the KYC document of the user if found, or null if no document exists for the user.
   */
  async findUserKycDocument(userId: string): Promise<KycDocument | null> {
    return KycDocument.query()
      .where('user_id', userId)
      .preload('agent')
      .preload('attempts', (attemptQuery) => {
        attemptQuery.preload('agent').orderBy('createdAt', 'desc')
      })
      .preload('user', (userQuery) => {
        userQuery.preload('wallet')
      })
      .first()
  }

  /**
   * Saves a KYC (Know Your Customer) document to the database.
   *
   * @param {KycDocument} kycDocument - The KYC document to be saved.
   * @return {Promise<KycDocument>} A promise that resolves to the saved KYC document.
   */
  async saveKycDocument(kycDocument: KycDocument): Promise<KycDocument> {
    return kycDocument.save()
  }

  /**
   * Find all KYC documents with pagination and filters
   * @param page
   * @param perPage
   * @param filters
   */
  async findAll(
    page: number,
    perPage: number,
    filters?: {
      status?: string
      documentType?: string
      userId?: string
      search?: string
      startDate?: string
      endDate?: string
    }
  ): Promise<any> {
    const query = KycDocument.query().preload('user').preload('agent')

    if (filters?.status) {
      query.where('status', filters.status)
    }

    if (filters?.documentType) {
      query.where('document_type', filters.documentType)
    }

    if (filters?.userId) {
      query.where('user_id', filters.userId)
    }

    if (filters?.search) {
      query.whereHas('user', (userQuery) => {
        userQuery
          .where('firstname', 'like', `%${filters.search}%`)
          .orWhere('lastname', 'like', `%${filters.search}%`)
          .orWhere('phone', 'like', `%${filters.search}%`)
          .orWhere('users_uid', 'like', `%${filters.search}%`)
      })
    }

    if (filters?.startDate || filters?.endDate) {
      query.withScopes((scopes) => scopes.filterByDateRange(filters.startDate, filters.endDate))
    }

    return query.orderBy('updated_at', 'desc').paginate(page, perPage)
  }

  /**
   * Retrieves statistical information related to KYC documents, including the total number of documents,
   * count of documents based on their status (pending, approved, rejected), and counts categorized by
   * document types (CNI, PASSPORT, PERMIT_CONDUIT).
   *
   * @return {Promise<Object>} An object containing the statistics:
   * - `total` (number): Total number of KYC documents.
   * - `pending` (number): Number of KYC documents with status "PENDING".
   * - `verified` (number): Number of KYC documents with status "APPROVED".
   * - `rejected` (number): Number of KYC documents with status "REJECTED".
   * - `byDocumentType` (Object): Counts categorized by document types:
   *   - `CNI` (number): Count of documents with type "CNI".
   *   - `PASSPORT` (number): Count of documents with type "PASSPORT".
   *   - `PERMIT_CONDUIT` (number): Count of documents with type "PERMIT_CONDUIT".
   */
  async getStats(): Promise<any> {
    const [allTime, today] = await Promise.all([
      KycDocument.query()
        .select(
          db.raw('COUNT(*) as total'),
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending`, [
            KycDocumentStatus.PENDING,
          ]),
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved`, [
            KycDocumentStatus.APPROVED,
          ]),
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected`, [
            KycDocumentStatus.REJECTED,
          ]),
          db.raw(`SUM(CASE WHEN document_type = ? THEN 1 ELSE 0 END) as cni`, [
            KycDocumentType.CNI,
          ]),
          db.raw(`SUM(CASE WHEN document_type = ? THEN 1 ELSE 0 END) as passport`, [
            KycDocumentType.PASSPORT,
          ]),
          db.raw(`SUM(CASE WHEN document_type = ? THEN 1 ELSE 0 END) as permit`, [
            KycDocumentType.PERMIT_CONDUIT,
          ])
        )
        .first(),

      KycAttemp.query()
        .whereRaw('DATE(created_at) = CURDATE()')
        .select(
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as today_submitted`, [
            KycDocumentStatus.PENDING,
          ]),
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as today_approved`, [
            KycDocumentStatus.APPROVED,
          ]),
          db.raw(`SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as today_rejected`, [
            KycDocumentStatus.REJECTED,
          ])
        )
        .first(),
    ])

    const extras = allTime?.$extras || {}
    const todayExtras = today?.$extras || {}

    const todaySubmitted = Number(todayExtras.today_submitted || 0)
    const todayApproved = Number(todayExtras.today_approved || 0)
    const todayRejected = Number(todayExtras.today_rejected || 0)

    return {
      total: Number(extras.total || 0),
      pending: Number(extras.pending || 0),
      verified: Number(extras.approved || 0),
      rejected: Number(extras.rejected || 0),
      byDocumentType: {
        CNI: Number(extras.cni || 0),
        PASSPORT: Number(extras.passport || 0),
        PERMIT_CONDUIT: Number(extras.permit || 0),
      },
      today: {
        submitted: todaySubmitted,
        approved: todayApproved,
        rejected: todayRejected,
        processed: todayApproved + todayRejected,
      },
    }
  }

  /**
   * Retrieves a KycDocument by its unique identifier.
   *
   * @param {number} id - The unique identifier of the KycDocument to be retrieved.
   * @return {Promise<KycDocument | null>} A promise that resolves to the KycDocument instance if found, or null if not found.
   */
  async findById(id: number): Promise<KycDocument | null> {
    return KycDocument.query()
      .where('id', id)
      .preload('agent')
      .preload('user', (userQuery) => {
        userQuery.preload('wallet')
      })
      .preload('attempts', (attemptQuery) => {
        attemptQuery.preload('agent').orderBy('createdAt', 'desc')
      })
      .first()
  }

  /**
   * Fetches the most recent attempt for the specified user and document type.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} documentType - The type of document associated with the attempt.
   * @return {Promise<any | null>} A promise that resolves to the most recent attempt object or null if no attempts are found.
   */
  async findLastAttempt(userId: string, documentType: string): Promise<any | null> {
    return KycAttemp.query()
      .where('userId', userId)
      .where('documentType', documentType)
      .orderBy('attemptNumber', 'desc')
      .first()
  }

  /**
   * Saves the provided KYC attempt to the database or persistence layer.
   *
   * @param {KycAttemp} attempt - The KYC attempt object to be saved.
   * @return {Promise<void>} A promise that resolves when the save operation completes.
   */
  async saveAttempt(attempt: KycAttemp): Promise<void> {
    await attempt.save()
  }

  /**
   * Returns the number of KYC documents currently in the given status.
   *
   * @param {KycDocumentStatus} status - The status to count.
   * @return {Promise<number>} A promise resolving to the total number of documents with that status.
   */
  async countByStatus(status: KycDocumentStatus): Promise<number> {
    const result = await KycDocument.query().where('status', status).count('* as total').first()
    return Number((result as any)?.$extras?.total ?? 0)
  }
}
