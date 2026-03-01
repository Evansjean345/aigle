import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#features/users/domain/models/user'
import DebitPhoneRepository from '#features/user/domain/interfaces/debit_phone_repository'
import { normalizePhone } from '#shared/utils/utiles'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

@inject()
export default class DebitPhoneValidationService {
  /**
   * Creates an instance of the class with the provided DebitPhoneRepository.
   *
   * @param {DebitPhoneRepository} debitPhoneRepository - The repository instance used for handling debit phone operations.
   */
  constructor(private readonly debitPhoneRepository: DebitPhoneRepository) {}

  /**
   * Validates whether the provided phone number is authorized for debit operations for a specific provider and user.
   *
   * @param {string} phone - The phone number to be validated.
   * @param {number} providerId - The ID of the provider associated with the phone number.
   * @param {User} user - The user object containing information about the user initiating the operation.
   * @return {Promise<void>} A promise that resolves if the phone number is valid for debit or rejects with an error if not.
   */
  async validateDebitPhone(phone: string, providerId: number, user: User): Promise<void> {
    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone === normalizePhone(user.phone)) return

    const authorizedPhone = await this.debitPhoneRepository.findVerifiedByProvider(
      user.usersUid,
      providerId
    )

    if (!authorizedPhone || authorizedPhone.phone !== normalizedPhone) {
      transactionLog.error(
        'INVALIDE_DEBIT_PHONE_NUMBER',
        {
          user: { id: user.usersUid, phone: user.phone },
          payload: { phone, normalizedPhone, providerId: providerId.toString() },
        },
        'Tentative de débit sur un numéro non autorisé.'
      )

      throw new Exception(
        'Le numéro de téléphone fourni ne fait pas partie de vos numéros de rechargement autorisés.',
        {
          status: 400,
          code: 'INVALIDE_DEBIT_PHONE_NUMBER',
        }
      )
    }
  }
}
