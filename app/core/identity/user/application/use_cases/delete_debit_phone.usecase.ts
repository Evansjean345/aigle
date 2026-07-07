import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { DateTime } from 'luxon'
import DebitPhoneRepository from '#core/identity/user/domain/interfaces/debit_phone_repository'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import type { AuditContext } from '#core/identity/user/application/use_cases/add_debit_phone.usecase'

const MIN_DAYS_BEFORE_CHANGE = 15

@inject()
export default class DeleteDebitPhoneUseCase {
  /**
   * Initializes a new instance of the class with the specified DebitPhoneRepository.
   *
   * @param {DebitPhoneRepository} debitPhoneRepository - The repository used to manage debit phone operations.
   */
  constructor(private debitPhoneRepository: DebitPhoneRepository) {}

  /**
   * Executes the operation to delete a debit phone number for a user.
   *
   * @param {number} debitPhoneId - The unique identifier of the debit phone number to be deleted.
   * @param {string} userId - The unique identifier of the user associated with the debit phone number.
   * @return {Promise<{ message: string }>} A promise that resolves to an object containing a success message.
   * @throws {Exception} If the debit phone number is not found or if the deletion is attempted before the allowed modification period.
   */
  async execute(
    debitPhoneId: number,
    userId: string,
    auditContext?: AuditContext
  ): Promise<{ message: string }> {
    const debitPhone = await this.debitPhoneRepository.findById(debitPhoneId, userId)

    if (!debitPhone) {
      throw new Exception("Ce numéro débiteur n'existe pas.", {
        status: 404,
        code: 'DEBIT_PHONE_NOT_FOUND',
      })
    }

    if (debitPhone.verifiedAt) {
      const daysSinceVerification = DateTime.now().diff(debitPhone.verifiedAt, 'days').days

      if (daysSinceVerification < MIN_DAYS_BEFORE_CHANGE) {
        const remainingDays = Math.ceil(MIN_DAYS_BEFORE_CHANGE - daysSinceVerification)

        throw new Exception(
          `Vous ne pouvez pas supprimer un numéro débiteur avant ${MIN_DAYS_BEFORE_CHANGE} jours après sa validation. Il reste ${remainingDays} jour(s) avant de pouvoir effectuer cette action.`,
          {
            status: 403,
            code: 'DEBIT_PHONE_CHANGE_TOO_EARLY',
          }
        )
      }
    }

    await this.debitPhoneRepository.delete(debitPhoneId, userId)

    emitter
      .emit('activity:audit', {
        eventCategory: 'USER_SECURITY',
        eventAction: 'DEBIT_PHONE_DELETED',
        actorId: userId,
        actorType: 'User',
        targetType: 'DebitPhone',
        targetId: String(debitPhoneId),
        result: AuditResult.SUCCESS,
        ipAddress: auditContext?.ipAddress ?? null,
        userAgent: auditContext?.userAgent ?? null,
        requestId: auditContext?.requestId ?? null,
        metadata: { phone: debitPhone.phone, providerId: debitPhone.providerId },
      })
      .catch((_) => {})

    return { message: 'Numéro débiteur supprimé avec succès.' }
  }
}
