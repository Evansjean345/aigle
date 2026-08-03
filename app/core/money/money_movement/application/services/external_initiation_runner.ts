import { inject } from '@adonisjs/core'
import TransactionFailureHandler from '#core/money/transactions/application/services/transaction_failure_handler'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import ProviderErrorReporter from '#shared/infrastructure/services/provider_error_reporter'
import { PROVIDER_SEVERITY_MAP } from '#shared/enums/provider_error_severity_map'
import { ErrorSeverity } from '#shared/enums/provider_error_enums'
import type { ClassifiedError } from '#shared/infrastructure/services/error_classifier'
import ProviderInitiationError from '#core/money/money_movement/domain/exceptions/provider_initiation_error'
import type { FlowEventName } from '#core/money/transactions/application/jobs/dispatch_flow_event_job'
import type { ExternalInitiationResult } from '#core/money/money_movement/domain/types/money_movement_types'
import PaymentRepository from '#core/money/transactions/domain/interfaces/payment_repository'
import paymentLog from '#shared/infrastructure/logging/payment_log'

/**
 * Contexte d'une initiation externe, pour le traitement d'échec (classification / report / reversal).
 */
export interface InitiationRunContext {
  transactionId: number
  transactionReference: string
  paymentId: number
  operator: string
  paymentMethod: string
  /** Corrélation logs (`DEPOSIT_CHECKOUT`, `TRANSFER_PAYOUT`, `INTER_TRANSFER_INIT`...). */
  logCode: string
  /** Présent si le flux a débité le wallet (transfert) → auto-reversal au refund. */
  walletId?: number
  /** Event d'échec dispatché au produit (listeners risk/notifications). */
  failureEvent: FlowEventName
  failureEventData: Record<string, any>
}

/**
 * Enveloppe l'initiation externe avec le traitement d'échec.
 *
 * Depuis la bascule locale, la stratégie appelle le provider EN SYNCHRONE et lève
 * `ProviderInitiationError` sur échec — au lieu du job async d'antan. Ce runner rétablit la chaîne
 * qui vivait dans le job supprimé : **classification** (ProviderErrorService), **report** (log par
 * sévérité + `alert:provider error` → mail admin + audit, via ProviderErrorReporter), puis
 * **TransactionFailureHandler** (mark tx/payment FAILED + auto-reversal refund si wallet débité +
 * persistance de la définition d'erreur + dispatch de l'event d'échec produit). L'erreur est
 * ensuite propagée à l'appelant (réponse d'échec synchrone au client).
 */
@inject()
export default class ExternalInitiationRunner {
  constructor(
    private readonly failureHandler: TransactionFailureHandler,
    private readonly paymentRepository: PaymentRepository
  ) {}

  async run(
    ctx: InitiationRunContext,
    initiate: () => Promise<ExternalInitiationResult>
  ): Promise<ExternalInitiationResult> {
    try {
      const result = await initiate()
      await this.attachProviderTrace(ctx, result)
      return result
    } catch (error) {
      if (error instanceof ProviderInitiationError) {
        await this.onInitiationFailure(ctx, error)
      }
      throw error
    }
  }

  /**
   * Rend le mouvement **interrogeable** : persiste sur le paiement la référence provider et
   * l'agrégateur retenu par le routage. Sans ces deux données, la réconciliation ne
   * peut ni identifier le mouvement chez l'opérateur, ni savoir *qui* interroger.
   *
   * Point de passage **unique** des 4 initiations (out / in / inter jambes 1-2) → une seule écriture
   * à maintenir. **Best-effort** : un échec ici ne doit jamais faire échouer une initiation déjà
   * acceptée par l'opérateur (l'argent est parti) — au pire le mouvement ne sera pas réconciliable.
   */
  private async attachProviderTrace(
    ctx: InitiationRunContext,
    result: ExternalInitiationResult
  ): Promise<void> {
    if (!result.providerReference && !result.aggregator) return

    try {
      const payment = await this.paymentRepository.findById(ctx.paymentId)
      if (!payment) return

      payment.providerReference = result.providerReference ?? null
      payment.aggregator = result.aggregator ?? null
      await this.paymentRepository.save(payment)
    } catch (error) {
      paymentLog.warn(
        'PROVIDER_TRACE_PERSIST_FAILED',
        {
          reference: ctx.transactionReference,
          paymentId: ctx.paymentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Référence provider/agrégateur non persistée — mouvement non réconciliable automatiquement'
      )
    }
  }

  private async onInitiationFailure(
    ctx: InitiationRunContext,
    error: ProviderInitiationError
  ): Promise<void> {
    const definition = ProviderErrorService.resolve(error.providerErrorCode)
    const classified: ClassifiedError = {
      severity: PROVIDER_SEVERITY_MAP[definition.code] ?? ErrorSeverity.AMBIGUOUS,
      category: definition.category,
      adminAction: definition.adminAction,
      adminMessage: definition.adminMessage,
      retryable: error.retryable,
    }

    // Log par sévérité + alerte admin (mail + audit) si l'admin doit agir.
    ProviderErrorReporter.report(
      classified,
      { message: error.message, code: error.providerErrorCode },
      {
        logPrefix: ctx.logCode,
        transactionReference: ctx.transactionReference,
        provider: ctx.operator,
        paymentMethod: ctx.paymentMethod,
        operationType: ctx.logCode,
      }
    )

    // Mark FAILED + auto-reversal refund (si wallet débité) + persistance definition + notification.
    await this.failureHandler.handle({
      transactionId: ctx.transactionId,
      transactionReference: ctx.transactionReference,
      logCode: ctx.logCode,
      walletId: ctx.walletId,
      payment: {
        paymentId: ctx.paymentId,
        providerErrorCode: error.providerErrorCode,
        operatorResponse: { code: error.providerErrorCode, message: error.message },
      },
      notification: {
        flowEvent: ctx.failureEvent,
        flowData: ctx.failureEventData,
      },
    })
  }
}
