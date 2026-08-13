import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import ProviderRepository from '#core/catalog/catalogs/domain/interfaces/provider_repository'
import OtpSendingService from '#core/identity/otp/application/services/otp_sending_service'
import DebitPhone from '#core/identity/user/domain/models/debit_phone'
import { normalizePhone } from '#shared/utils/utiles'
import securityLog from '#shared/infrastructure/logging/security_log'
import DebitPhoneOtpTemplate from '#core/identity/otp/domain/templates/debit_phone_otp_template'
import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import UserOtpAttemptGuard from '#core/identity/authentication/application/services/user_otp_attempt_guard'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'
import Provider from '#core/catalog/catalogs/domain/models/provider'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

export interface AuditContext {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

const MIN_DAYS_BEFORE_CHANGE = 3

@inject()
export default class AddDebitPhoneUseCase {
  /**
   * Constructs an instance of the class.
   *
   * @param {DebitPhoneRepository} debitPhoneRepository - Repository for managing debit phone-related data.
   * @param {ProviderRepository} providerRepository - Repository for managing provider-related data.
   * @param otpSendingService
   * @param {UserRepository} userRepository - Repository for managing user-related data.
   * @param otpAttemptGuard
   */
  constructor(
    private debitPhoneRepository: DebitPhoneRepository,
    private providerRepository: ProviderRepository,
    private otpSendingService: OtpSendingService,
    private userRepository: UserRepository,
    private otpAttemptGuard: UserOtpAttemptGuard
  ) {}

  /**
   * Executes the process of updating or registering a user's debit phone number with a mobile money provider.
   * This method performs validation checks, ensures compliance with business rules, and sends an OTP
   * (One-Time Password) to validate the new or updated phone number.
   *
   * @param {string} userId - The unique identifier of the user making the request.
   * @param {string} phone - The phone number to be registered or updated, in normalized format.
   * @param {string} providerCode - The code of the mobile money provider associated with the phone number.
   * @param {string} [label] - An optional label to associate with the phone number for easier identification.
   * @param auditContext
   * @return {Promise<{message: string}>} A promise resolving to an object containing a message indicating the result of the operation.
   * @throws {Exception} Throws an exception if the provider is not of type "mobile-money", if the user attempts to change
   *                     a verified debit phone number before the minimum allowed days, if the phone number already
   *                     exists and is verified, or in other cases of invalid data or state.
   */
  async execute(
    userId: string,
    phone: string,
    providerCode: string,
    label?: string,
    auditContext?: AuditContext
  ): Promise<{ message: string }> {
    const normalizedPhone = normalizePhone(phone)

    const user = await this.userRepository.findById(userId)
    if (!user) throw new UserAccountNotFoundException()
    await this.otpAttemptGuard.assertNotBlocked(user)

    await this.isPrincipalPhoneNumber(userId, normalizedPhone)
    const provider = await this.ensureIsMobileMoneyProvider(providerCode)

    const existingForProvider = await this.debitPhoneRepository.findByUserAndProvider(
      userId,
      provider.id
    )

    if (existingForProvider && existingForProvider.isVerified) {
      // Vérifier la contrainte de 15 jours
      if (existingForProvider.verifiedAt) {
        const daysSinceVerification = DateTime.now().diff(
          existingForProvider.verifiedAt,
          'seconds'
        ).seconds

        if (daysSinceVerification < MIN_DAYS_BEFORE_CHANGE) {
          const remainingDays = Math.ceil(MIN_DAYS_BEFORE_CHANGE - daysSinceVerification)

          throw new Exception(
            `Vous ne pouvez pas modifier un numéro débiteur avant ${MIN_DAYS_BEFORE_CHANGE} jours après sa validation. Il reste ${remainingDays} jour(s) avant de pouvoir effectuer cette action.`,
            {
              status: 403,
              code: 'DEBIT_PHONE_CHANGE_TOO_EARLY',
            }
          )
        }
      }

      existingForProvider.phone = normalizedPhone
      existingForProvider.label = label || existingForProvider.label
      existingForProvider.isVerified = false
      existingForProvider.verifiedAt = null
      await this.debitPhoneRepository.save(existingForProvider)

      await this.otpSendingService.send(normalizedPhone, userId, new DebitPhoneOtpTemplate())

      securityLog.info(
        'DEBIT_PHONE_UPDATE_OTP_SENT',
        { userId, phone: normalizedPhone, providerCode, providerName: provider.name },
        'Numéro débiteur mis à jour (après 15 jours), OTP envoyé pour revalidation.'
      )

      return { message: 'Un code OTP a été envoyé au nouveau numéro fourni. Veuillez le valider.' }
    }

    const existingPhone = await this.debitPhoneRepository.findByUserAndPhone(
      userId,
      normalizedPhone
    )

    if (existingPhone && existingPhone.isVerified) {
      throw new Exception(
        'Ce numéro de téléphone est déjà enregistré et vérifié sur votre compte.',
        { status: 409, code: 'DEBIT_PHONE_ALREADY_EXISTS' }
      )
    }

    if (existingForProvider && !existingForProvider.isVerified) {
      existingForProvider.phone = normalizedPhone
      existingForProvider.label = label || null
      await this.debitPhoneRepository.save(existingForProvider)
    } else if (!existingPhone) {
      const debitPhone = new DebitPhone()
      debitPhone.userId = userId
      debitPhone.phone = normalizedPhone
      debitPhone.providerId = provider.id
      debitPhone.label = label || provider.name
      debitPhone.isVerified = false
      debitPhone.isActive = false
      await this.debitPhoneRepository.save(debitPhone)
    }

    await this.otpSendingService.send(normalizedPhone, userId, new DebitPhoneOtpTemplate())

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'DEBIT_PHONE_ADDED',
        actorId: userId,
        actorType: 'User',
        targetType: 'DebitPhone',
        targetId: normalizedPhone,
        result: AuditResult.SUCCESS,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: auditContext?.userAgent ?? null,
        requestId: auditContext?.requestId ?? null,
        metadata: { phone: normalizedPhone, providerCode, providerName: provider.name },
      })
      .catch((_) => {})

    return { message: 'Un code OTP a été envoyé au numéro fourni. Veuillez le valider.' }
  }

  /**
   * Checks if the provided phone number matches the principal phone number of the user.
   *
   * @param {string} userId - The ID of the user whose phone number is being verified.
   * @param {string} phone - The phone number to compare against the user's principal phone.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating if the phone numbers match.
   * @throws {Exception} If the user is not found in the repository.
   */
  private async isPrincipalPhoneNumber(userId: string, phone: string): Promise<void> {
    const user = await this.userRepository.findById(userId)

    if (user && normalizePhone(user.phone) === phone) {
      throw new Exception(
        'Vous ne pouvez pas utiliser votre numéro de téléphone principal comme autre numéro débiteur.',
        { status: 400, code: 'DEBIT_PHONE_IS_USER_PHONE' }
      )
    }
  }

  /**
   * Ensures that the specified provider is a mobile money provider.
   *
   * @param {string} providerCode - The unique code of the provider to validate.
   * @return {Promise<Provider>} A promise that resolves to the provider if it is a mobile money provider.
   * @throws {Exception} Throws an exception if the provider is not of type 'mobile-money', including details about the error and status code.
   */
  private async ensureIsMobileMoneyProvider(providerCode: string): Promise<Provider> {
    const provider = await this.providerRepository.findByCode(providerCode)

    if (provider.type !== 'mobile-money') {
      throw new Exception(
        "L'opérateur sélectionné n'est pas un opérateur mobile money. Seuls les opérateurs mobile money sont autorisés pour les numéros débiteurs.",
        { status: 400, code: 'INVALID_PROVIDER_TYPE' }
      )
    }

    return provider
  }
}
