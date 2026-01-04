import type { ApplicationService } from '@adonisjs/core/types'

import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import TransactionRepositoryImpl from '#features/transactions/infrastructure/repositories/transaction_repository_impl'
import PaymentRepository from '#features/transactions/domain/interfaces/payment_repository'
import PaymentRepositoryImpl from '#features/transactions/infrastructure/repositories/payment_repository_impl'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'
import RedisTransactionVolumeCache from '#features/transactions/infrastructure/redis_transaction_volume_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import RedisIdempotencyProvider from '#features/transactions/infrastructure/redis_idempotency_provider'

export default class TransactionProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const providers = new Map<any, any>([
      [TransactionRepository, TransactionRepositoryImpl],
      [PaymentRepository, PaymentRepositoryImpl],
      [TransactionVolumeCache, RedisTransactionVolumeCache],
      [IdempotencyProvider, RedisIdempotencyProvider],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }
  }
}
