import Otp from '#features/otp/domain/models/otp'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import OtpRepository from '#features/otp/domain/interfaces/otp_repository'

export default class OtpRepositoryImpl implements OtpRepository {
  async save(data: Otp, trx?: TransactionClientContract): Promise<Otp> {
    if (trx) {
      return data.useTransaction(trx).save()
    }
    return data.save()
  }

  async check(identifier: string, target: 'mobile' | 'email'): Promise<Otp | null> {
    const query = Otp.query().where('target', target)
    if (target === 'email') {
      query.where('email', identifier)
    } else {
      query.where('phone', identifier)
    }
    return await query.orderBy('created_at', 'desc').first()
  }

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
