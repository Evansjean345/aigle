export enum AuditResult {
  SUCCESS = 'success',
  FAILURE = 'failed',
  PENDING = 'pending',
}

export enum SecurityAlertType {
  BRUTE_FORCE = 'BRUTE_FORCE',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  MASS_EXPORT = 'MASS_EXPORT',
  OFF_HOURS_ACCESS = 'OFF_HOURS_ACCESS',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}
