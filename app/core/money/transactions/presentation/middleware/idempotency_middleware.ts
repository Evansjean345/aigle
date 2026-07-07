import { HttpContext } from '@adonisjs/core/http'
import { NextFn } from '@adonisjs/core/types/http'
import { inject } from '@adonisjs/core'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import TransactionService from '#core/money/transactions/application/services/transaction_service'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'

@inject()
export default class IdempotencyMiddleware {
  /**
   * Constructs an instance of the class with the required dependencies.
   *
   * @param {IdempotencyProvider} idempotency - The provider responsible for handling idempotency logic.
   * @param {TransactionService} transactionService - The service responsible for managing transactions.
   */
  constructor(
    private idempotency: IdempotencyProvider,
    private transactionService: TransactionService
  ) {}

  /**
   * Handles idempotency for incoming requests by checking for a unique key in the request header.
   * Ensures requests with the same idempotency key are processed in a consistent manner.
   *
   * @param {HttpContext} ctx - The context object that provides access to the request and response objects.
   * @param {NextFn} next - The function to invoke the next middleware in the pipeline.
   * @return {Promise<void>} A promise that resolves when the middleware logic is complete.
   */
  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const { request, response } = ctx
    const key = request.header('X-Idempotency-Key')

    if (!key) {
      return response.badRequest({ message: 'X-Idempotency-Key header is missing.' })
    }

    const value = await this.idempotency.get(key)

    if (value) {
      if (value === 'PROCESSING') {
        return response.conflict({
          message: 'Cette transaction est déjà en cours de traitement.',
          code: 'E_DUPLICATE_TRANSACTION',
        })
      }

      // Optimization: If we have the full response cached, return it directly
      if (value.startsWith('{')) {
        try {
          const cachedResponse = JSON.parse(value)
          return response.ok(cachedResponse)
        } catch (e) {
          // If JSON parsing fails, continue to DB fallback
        }
      }

      try {
        const transaction = await this.transactionService.getByUidOrId(value)
        let waveUrl: string | undefined

        if (transaction.payment && transaction.operationType === TransactionType.DEPOSIT) {
          const wavePayment = transaction.payment.find(
            (p) => p.paymentDetails && (p.paymentDetails as any).operator === 'wave'
          )

          if (wavePayment && wavePayment.operatorResponse) {
            waveUrl = (wavePayment.operatorResponse as any).payment_details?.wave_launch_url
          }
        }

        return response.ok({
          message: 'transaction initiated',
          data: {
            transactionReference: transaction.reference,
            status: transaction.status as TransactionStatus,
            ...(waveUrl && { wave_url: waveUrl }),
          },
        })
      } catch (error) {
        return response.conflict({
          message: 'Cette transaction a déjà été traitée.',
          code: 'E_DUPLICATE_TRANSACTION',
        })
      }
    }

    // Mark as processing and continue
    await this.idempotency.checkAndMark(key)
    await next()

    // If the use case errored (4xx/5xx response) and the key is still in
    // PROCESSING state (the use case threw before updating with a result),
    // free the orphaned key so the next retry can run a fresh attempt.
    // We deliberately do NOT delete keys that already hold a real result
    // (transaction UID or cached JSON) — those are valid idempotent caches.
    if (response.getStatus() >= 400) {
      const current = await this.idempotency.get(key)

      if (current === 'PROCESSING') {
        await this.idempotency.delete(key)
      }
    }
  }
}
