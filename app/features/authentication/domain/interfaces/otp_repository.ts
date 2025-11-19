import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Otp from '#features/authentication/domain/models/otp'

export default abstract class OtpRepository {
  abstract save(data: Otp, trx?: TransactionClientContract): Promise<Otp>

  abstract check(phone: string): Promise<Otp | null>

  abstract delete(phone: string): Promise<void>
}
