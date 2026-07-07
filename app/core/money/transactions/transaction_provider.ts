import type { ApplicationService } from '@adonisjs/core/types'

import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import TransactionRepositoryImpl from '#core/money/transactions/infrastructure/repositories/transaction_repository_impl'
import PaymentRepository from '#core/money/transactions/domain/interfaces/payment_repository'
import PaymentRepositoryImpl from '#core/money/transactions/infrastructure/repositories/payment_repository_impl'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import RedisTransactionVolumeCache from '#core/money/transactions/infrastructure/redis_transaction_volume_cache'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import RedisIdempotencyProvider from '#core/money/transactions/infrastructure/redis_idempotency_provider'
import TransactionSecurityContextRepository from '#core/money/transactions/domain/interfaces/transaction_security_context_repository'
import TransactionSecurityContextRepositoryImpl from '#core/money/transactions/infrastructure/repositories/transaction_security_context_repository_impl'
import RefundRepository from '#core/money/transactions/domain/interfaces/refund_repository'
import RefundRepositoryImpl from '#core/money/transactions/infrastructure/repositories/refund_repository_impl'

export default class TransactionProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const providers = new Map<any, any>([
      [TransactionRepository, TransactionRepositoryImpl],
      [PaymentRepository, PaymentRepositoryImpl],
      [TransactionVolumeCache, RedisTransactionVolumeCache],
      [IdempotencyProvider, RedisIdempotencyProvider],
      [TransactionSecurityContextRepository, TransactionSecurityContextRepositoryImpl],
      [RefundRepository, RefundRepositoryImpl],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }
  }
}
