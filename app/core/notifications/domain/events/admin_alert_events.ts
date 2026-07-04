import type { ErrorSeverity, AdminAction, ErrorCategory } from '#shared/enums/provider_error_enums'

export interface AdminProviderErrorAlertEvent {
  severity: ErrorSeverity
  category: ErrorCategory
  adminAction: AdminAction
  adminMessage: string
  errorCode: string
  transactionReference: string
  provider: string
  context: Record<string, any>
}
