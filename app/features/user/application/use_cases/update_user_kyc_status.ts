import UserRepository from '#features/user/domain/interfaces/user_repository'
import { inject } from '@adonisjs/core'
import { UserKycStatus } from '#features/user/domain/enum'
import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'
import UserKycStatusUpdated from '#features/user/application/events/user_kyc_status_updated'
import UserAccountNotFoundException from '#features/authentication/infrastructure/exceptions/user_account_not_found_exception'
import appLog from '#shared/infrastructure/logging/app_log'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface UpdateUserKycStatusAuditContext {
  actorId?: string | null
  actorType?: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

@inject()
export default class UpdateUserKycStatus {
  /**
   * Constructs an instance of the class with a dependency on UserRepository.
   *
   * @param {UserRepository} userRepository - The repository used to manage user data.
   * @param transactionVolumeCache
   */
  constructor(
    private userRepository: UserRepository,
    private readonly transactionVolumeCache: TransactionVolumeCache
  ) {}

  /**
   * Executes the process of retrieving a user by ID and performing an action based on their KYC status.
   * Throws an exception if the user is not found.
   *
   * @param {string} userId - The unique identifier of the user to be retrieved.
   * @param {UserKycStatus} status - The KYC (Know Your Customer) status associated with the user.
   * @param {KycLevelState} kycLevel - The KYC level associated with the user.
   * @param {string} comment - An optional comment.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   * @throws {UserAccountNotFoundException} If the user does not exist, it throws a UserAccountNotFoundException.
   */
  async execute(
    userId: string,
    status: UserKycStatus,
    kycLevel?: KycLevelState,
    comment?: string,
    auditContext?: UpdateUserKycStatusAuditContext
  ): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      appLog.warn(
        'USER_ACCOUNT_NOT_FOUND',
        {
          userId: userId,
          status: status,
        },
        `user with id ${userId} does not exist`
      )

      throw new UserAccountNotFoundException('Aucun utilisateur trouvé')
    }

    const previousStatus = user.kycStatus
    const previousLevel = user.kycLevel

    try {
      user.kycStatus = status

      if (kycLevel) {
        user.kycLevel = kycLevel
      }

      if (status === UserKycStatus.VERIFIED) {
        user.kycLevel = KycLevelState.KYC_VERIFIED
        await this.transactionVolumeCache.clearVolume(user.usersUid)
      }

      await this.userRepository.save(user)
      await UserKycStatusUpdated.dispatch(userId, status, kycLevel, comment)

      emitter
        .emit('activity:audit', {
          eventCategory: 'USER_KYC',
          eventAction: 'USER_KYC_STATUS_CHANGED',
          actorId: auditContext?.actorId ?? 'system',
          actorType: auditContext?.actorType ?? 'System',
          targetType: 'User',
          targetId: userId,
          result: AuditResult.SUCCESS,
          ipAddress: auditContext?.ipAddress ?? null,
          userAgent: auditContext?.userAgent ?? null,
          requestId: auditContext?.requestId ?? null,
          metadata: {
            fromStatus: previousStatus ?? null,
            toStatus: status,
            fromLevel: previousLevel ?? null,
            toLevel: user.kycLevel ?? null,
            comment: comment ?? null,
            geoCountry: auditContext?.geoLocation?.countryCode ?? null,
            geoCity: auditContext?.geoLocation?.city ?? null,
            isVpn: auditContext?.geoLocation?.isVpn ?? null,
          },
        })
        .catch((_) => {})
    } catch (error) {
      appLog.error(
        'ERROR_UPDATING_USER_KYC_STATUS',
        {
          message: error.message,
          status: status,
          stack: error.stack,
        },
        "error while updating user's kyc status"
      )
      throw error
    }
  }
}
