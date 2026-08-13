import { inject } from '@adonisjs/core'
import KycDocumentRepository from '#core/identity/kyc/domain/interfaces/kyc_document_repository'
import { statusOfFile } from '#core/identity/kyc/domain/verification_status'
import type { UserKycStatus } from '#core/identity/user/domain/enum'

/** Rend le statut de vérification des comptes, dérivé de leur dossier. */
@inject()
export default class AccountVerificationStatusService {
  constructor(private readonly kycDocumentRepository: KycDocumentRepository) {}

  /**
   * Rend le statut de vérification de chaque compte demandé, en une requête.
   *
   * Un compte sans dossier est omis de la carte.
   *
   * @param {string[]} accountIds - Comptes dont on cherche le statut.
   * @returns {Promise<Map<string, UserKycStatus>>} Le statut par compte, comptes sans dossier omis.
   */
  async statusOf(accountIds: string[]): Promise<Map<string, UserKycStatus>> {
    const statuses = await this.kycDocumentRepository.findLatestStatusByAccountIds(accountIds)

    return new Map(
      [...statuses].map(([accountId, status]) => [accountId, statusOfFile({ status })])
    )
  }
}
