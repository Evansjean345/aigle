import Otp from '#shared/models/otp'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import OtpRepository from '#shared/interfaces/repositories/OtpRepository'

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
   * Checks and retrieves the most recent OTP record for the given phone number.
   *
   * @param {string} phone - The phone number to query the OTP record for.
   * @return {Promise<Otp | null>} - A promise that resolves to the most recent OTP record
   * for the given phone number, or null if no record is found.
   */
  async check(phone: string): Promise<Otp | null> {
    return await Otp.query().where('phone', phone).orderBy('created_at', 'desc').first()
  }

  /**
   * Deletes Otp records associated with the given phone number.
   *
   * @param {string} phone - The phone number whose associated Otp records will be deleted.
   * @return {Promise<void>} A promise that resolves when the deletion is complete.
   */
  async delete(phone: string): Promise<void> {
    await Otp.query().where('phone', phone).delete()
  }
}
