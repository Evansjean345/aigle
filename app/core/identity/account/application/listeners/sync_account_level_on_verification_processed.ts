import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import AccountService from '#core/identity/account/application/services/account_service'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AuditResult } from '#core/audit/domain/enums'
import { requirementsFor } from '#core/identity/kyc/domain/verification_requirements'

/**
 * Porte un compte à son niveau cible quand son dossier de vérification est approuvé.
 *
 * Traite les deux porteurs : le profil de vérification du compte dit ce que l'approbation accorde,
 * qu'il s'agisse d'un utilisateur ou d'une organisation.
 *
 * Un refus laisse le niveau inchangé.
 */
@inject()
export default class SyncAccountLevelOnVerificationProcessed {
  constructor(
    private readonly accountService: AccountService,
    private readonly accountStandingService: AccountStandingService,
    private readonly transactionVolumeCache: TransactionVolumeCache
  ) {}

  /**
   * Applique la montée de palier consécutive à une approbation, purge les volumes du compte et
   * journalise la décision.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @returns {Promise<void>} Résolue quand le niveau est posé, ou d'emblée s'il n'y a rien à poser.
   */
  async handle(event: KycDocumentProcessed): Promise<void> {
    if (event.status !== KycDocumentStatus.APPROVED) return

    const account = await this.accountStandingService.describe(event.accountId)

    if (!account) return

    const { grantsLevel } = requirementsFor(account.verificationProfile)

    if (grantsLevel === null) return

    const previousLevel = account.level

    await this.accountService.setLevel(event.accountId, grantsLevel)
    await this.transactionVolumeCache.clearVolume(event.accountId)

    this.audit(event, previousLevel, grantsLevel)
  }

  /**
   * Journalise le changement de palier.
   *
   * @param {KycDocumentProcessed} event - Décision de revue.
   * @param {number | null} fromLevel - Palier avant la décision.
   * @param {number} toLevel - Palier accordé.
   */
  private audit(event: KycDocumentProcessed, fromLevel: number | null, toLevel: number): void {
    emitter
      .emit('activity:audit', {
        eventCategory: 'KYC',
        eventAction: 'ACCOUNT_VERIFICATION_APPROVED',
        // L'événement ne porte pas l'agent : la décision vient toujours d'une revue admin.
        actorId: 'system',
        actorType: 'Admin',
        targetType: 'Account',
        targetId: event.accountId,
        result: AuditResult.SUCCESS,
        ipAddress: event.auditContext?.ipAddress ?? null,
        userAgent: event.auditContext?.userAgent ?? null,
        requestId: event.auditContext?.requestId ?? null,
        metadata: {
          ownerType: event.ownerType,
          fromLevel,
          toLevel,
          comment: event.comment ?? null,
          geoCountry: event.auditContext?.geoLocation?.countryCode ?? null,
          geoCity: event.auditContext?.geoLocation?.city ?? null,
          isVpn: event.auditContext?.geoLocation?.isVpn ?? null,
        },
      })
      .catch(() => {})
  }
}
