/**
 * Sévérité d'une erreur provider (classification du routage).
 * Adapté d'aiglehub (VO → enum + helpers, style aiglesend).
 */
export enum ErrorSeverity {
  /** Échec définitif — ne pas retenter. */
  DEFINITIVE = 'definitive',
  /** Transitoire — retenter. */
  RETRYABLE = 'retryable',
  /** État incertain — revue nécessaire. */
  AMBIGUOUS = 'ambiguous',
  /** Problème de configuration — alerter les ops. */
  CONFIGURATION = 'configuration',
}

export function shouldFail(severity: ErrorSeverity): boolean {
  return severity === ErrorSeverity.DEFINITIVE
}

export function shouldRetry(severity: ErrorSeverity): boolean {
  return severity === ErrorSeverity.RETRYABLE
}

export function requiresReview(severity: ErrorSeverity): boolean {
  return severity === ErrorSeverity.AMBIGUOUS || severity === ErrorSeverity.CONFIGURATION
}

export function shouldAlertOps(severity: ErrorSeverity): boolean {
  return severity === ErrorSeverity.CONFIGURATION
}
