import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Otp from '#core/otp/domain/models/otp'

export default abstract class OtpRepository {
  abstract save(data: Otp, trx?: TransactionClientContract): Promise<Otp>

  abstract check(identifier: string, target: 'mobile' | 'email'): Promise<Otp | null>

  abstract delete(identifier: string, target: 'mobile' | 'email'): Promise<void>
}
