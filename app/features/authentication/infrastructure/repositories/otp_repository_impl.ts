import Otp from '#features/authentication/domain/models/otp'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import OtpRepository from '#features/authentication/domain/interfaces/otp_repository'

export default class OtpRepositoryImpl implements OtpRepository {
  /**
   * Saves the given Otp data object. If a transaction is provided, the save operation will be performed
   * within the specified transaction.
   *
   * @param {Otp} data - The Otp object to be saved.
   * @param {TransactionClientContract} [trx] - Optional transaction object to perform the save operation within a transaction.
   * @return {Promise<any>} A promise that resolves once the save operation is completed.
   */
  async save(data: Otp, trx?: TransactionClientContract): Promise<Otp> {
    if (trx) {
      return data.useTransaction(trx).save()
    }
    return data.save()
  }

  /**
   * Checks and retrieves the most recent OTP record for the given identifier and target.
   *
   * @param {string} identifier - The phone number or email to query the OTP record for.
   * @param {'mobile' | 'email'} target - The target of the OTP (mobile or admin email).
   * @return {Promise<Otp | null>} - A promise that resolves to the most recent OTP record
   * for the given identifier and target, or null if no record is found.
   */
  async check(identifier: string, target: 'mobile' | 'email'): Promise<Otp | null> {
    const query = Otp.query().where('target', target)
    if (target === 'email') {
      query.where('email', identifier)
    } else {
      query.where('phone', identifier)
    }
    return await query.orderBy('created_at', 'desc').first()
  }

  /**
   * Deletes Otp records associated with the given identifier and target.
   *
   * @param {string} identifier - The phone number or email whose associated Otp records will be deleted.
   * @param {'mobile' | 'email'} target - The target of the OTP.
   * @return {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async delete(identifier: string, target: 'mobile' | 'email'): Promise<void> {
    const query = Otp.query().where('target', target)
    if (target === 'email') {
      query.where('email', identifier)
    } else {
      query.where('phone', identifier)
    }
    await query.delete()
  }
}
