import type { ErrorSeverity } from '#features/provider_gateway/domain/enums/error_severity'

/** Table de correspondance code d'erreur provider → sévérité (par provider). */
export type ProviderErrorMap = Record<string, ErrorSeverity>
