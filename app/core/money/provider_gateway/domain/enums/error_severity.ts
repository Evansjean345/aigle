/**
 * Sévérité d'une erreur provider (classification du routage).
 * Adapté d'aiglehub (VO → enum + helpers, style aiglesend).
 */
export enum ErrorSeverity {
  DEFINITIVE = 'definitive',
  RETRYABLE = 'retryable',
  AMBIGUOUS = 'ambiguous',
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
