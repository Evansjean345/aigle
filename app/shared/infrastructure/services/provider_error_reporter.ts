import emitter from '@adonisjs/core/services/emitter'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { ErrorSeverity, AdminAction } from '#shared/enums/provider_error_enums'
import type { ClassifiedError } from '#shared/infrastructure/services/error_classifier'

/**
 * Métadonnées qui contextualisent un échec d'appel agrégateur. Ce type
 * est volontairement structuré (et non un sac d'`any`) pour que
 * l'appelant — qu'il soit synchrone (`SyncCheckoutService`) ou asynchrone
 * (`BaseAggregatorJob`) — fournisse les mêmes informations de base, ce
 * qui rend les logs et alertes uniformes côté monitoring.
 */
export interface ProviderErrorContext {
  /** Code court servant à corréler les logs (`DEPOSIT_CHECKOUT`, `INTER_TRANSFER_INIT`, ...). */
  logPrefix: string
  /** Référence métier de la transaction concernée. */
  transactionReference: string
  /** Code provider courant (`orange`, `wave`, `mtn`...). */
  provider: string
  /** Méthode de paiement (`mobile_money`, `wallet`, ...). */
  paymentMethod: string
  /** Libellé court du flow (`deposit checkout`, `inter transfer`, ...) — utilisé dans `context.operationType`. */
  operationType: string
}

/**
 * Erreur brute remontée par l'agrégateur (statut HTTP, message, code
 * réseau). Présente même quand l'échec est une exception JS (timeout,
 * DNS) — `httpStatus` est alors `undefined` et `code` porte le `errno`
 * Node (`ETIMEDOUT`, `ECONNRESET`, ...).
 */
export interface ProviderRawError {
  message?: string
  code?: string
  statusCode?: number
  details?: unknown
}

/**
 * Pipeline partagé de traitement des erreurs provider.
 *
 * Avant cette classe, le code de logging conditionnel par sévérité et
 * d'émission d'alertes était dupliqué entre `BaseAggregatorJob` (côté
 * job/queue) et `SyncCheckoutService` (côté checkout sync). Les deux
 * branches divergeaient: les jobs émettaient `alert:provider-error`
 * pour le monitoring et logguaient au bon niveau (warn vs error selon
 * sévérité), alors que la branche sync se contentait d'un
 * `transactionLog.error` générique sans alerte. Conséquence: aucun
 * monitoring sur les échecs sync, et tout passait en `error` dans les
 * logs même pour des `RETRYABLE`/`AMBIGUOUS` qui devraient être en
 * `warn`.
 *
 * `ProviderErrorReporter` centralise les deux étapes pour que les deux
 * chemins (sync et async) reportent identiquement: même niveau de log
 * selon `severity`, même format d'événement `alert:provider-error`.
 */
export default class ProviderErrorReporter {
  /**
   * Reporte un échec provider classifié: log au bon niveau + émission
   * d'une alerte si l'admin doit faire quelque chose.
   *
   * À appeler par les deux flows (sync checkout & job aggregator) après
   * `ErrorClassifier.classify(...)`. Cette méthode ne touche ni à la
   * BDD, ni à `TransactionFailureHandler` — la responsabilité de
   * marquer la transaction comme failed reste à l'appelant.
   */
  static report(
    classified: ClassifiedError,
    rawError: ProviderRawError,
    context: ProviderErrorContext
  ): void {
    this.logByClassifiedError(classified, rawError, context)
    this.emitAlertIfNeeded(classified, rawError, context)
  }

  /**
   * Variante "exception JS" : à appeler dans le `catch` quand l'appel
   * agrégateur a échoué avant même de recevoir une réponse (timeout,
   * DNS, socket reset). Logge en `errorLog` (et non `paymentLog`) car
   * c'est une erreur de notre infrastructure réseau plutôt qu'une
   * réponse business du provider.
   */
  static reportNetworkException(
    classified: ClassifiedError,
    err: unknown,
    context: ProviderErrorContext
  ): void {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const code = (err as any)?.code

    errorLog.error(
      `${context.logPrefix}_INIT_ERROR`,
      {
        reference: context.transactionReference,
        error: message,
        severity: classified.severity,
      },
      `Failed to initiate ${context.operationType}`
    )

    this.emitAlertIfNeeded(classified, { message, code }, context)
  }

  /**
   * Logger l'échec provider au niveau approprié selon la `severity'. On
   * réserve `error` aux cas définitifs et de configuration (qui
   * indiquent un vrai problème côté nous), et on rétrograde en `warn`
   * les échecs transitoires ('RETRYABLE') ou unclassifiable
   * ('AMBIGUOUS') pour ne pas saturer les alertes.
   */
  private static logByClassifiedError(
    classified: ClassifiedError,
    rawError: ProviderRawError,
    context: ProviderErrorContext
  ): void {
    const meta = {
      reference: context.transactionReference,
      error: rawError,
      severity: classified.severity,
    }

    switch (classified.severity) {
      case ErrorSeverity.CONFIGURATION:
        paymentLog.error(
          `${context.logPrefix}_CONFIG_ERROR`,
          meta,
          'Aggregator rejected due to configuration issue'
        )
        break

      case ErrorSeverity.RETRYABLE:
        paymentLog.warn(
          `${context.logPrefix}_RETRYABLE`,
          meta,
          `${context.operationType} failed — retryable, will retry`
        )
        break

      case ErrorSeverity.AMBIGUOUS:
        paymentLog.warn(
          `${context.logPrefix}_AMBIGUOUS`,
          meta,
          `${context.operationType} failed — ambiguous error, needs investigation`
        )
        break

      case ErrorSeverity.DEFINITIVE:
        paymentLog.error(
          `${context.logPrefix}_DEFINITIVE`,
          meta,
          `${context.operationType} failed — definitive error`
        )
        break
    }
  }

  /**
   * Émet l'événement `alert:provider-error` consommé par le système de
   * monitoring/alerting côté admin. Skip si la classification ne
   * réclame aucune action admin (`AdminAction.NONE`) — sinon on
   * polluerait le canal pour rien.
   */
  private static emitAlertIfNeeded(
    classified: ClassifiedError,
    rawError: ProviderRawError,
    context: ProviderErrorContext
  ): void {
    if (classified.adminAction === AdminAction.NONE) return

    emitter
      .emit('alert:provider-error', {
        severity: classified.severity,
        category: classified.category,
        adminAction: classified.adminAction,
        adminMessage: classified.adminMessage,
        errorCode: 'HTTP_ERROR',
        transactionReference: context.transactionReference,
        provider: context.provider,
        context: {
          operationType: context.operationType,
          paymentMethod: context.paymentMethod,
          httpStatus: rawError.statusCode,
          message: rawError.message,
          details: rawError.details,
        },
      })
      .catch(() => {})
  }
}
