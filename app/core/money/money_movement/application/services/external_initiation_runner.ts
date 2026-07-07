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
 * Enveloppe l'initiation externe (stratégie locale) avec le traitement d'échec (Lot 3b).
 *
 * Depuis la bascule locale, la stratégie appelle le provider EN SYNCHRONE et lève
 * `ProviderInitiationError` sur échec — au lieu du job async d'antan. Ce runner rétablit la chaîne
 * qui vivait dans le job supprimé : **classification** (ProviderErrorService), **report** (log par
 * sévérité + `alert:provider-error` → mail admin + audit, via ProviderErrorReporter), puis
 * **TransactionFailureHandler** (mark tx/payment FAILED + auto-reversal refund si wallet débité +
 * persistance de la définition d'erreur + dispatch de l'event d'échec produit). L'erreur est
 * ensuite propagée à l'appelant (réponse d'échec synchrone au client).
 */
@inject()
export default class ExternalInitiationRunner {
  constructor(private readonly failureHandler: TransactionFailureHandler) {}

  async run(
    ctx: InitiationRunContext,
    initiate: () => Promise<ExternalInitiationResult>
  ): Promise<ExternalInitiationResult> {
    try {
      return await initiate()
    } catch (error) {
      if (error instanceof ProviderInitiationError) {
        await this.onInitiationFailure(ctx, error)
      }
      throw error
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
