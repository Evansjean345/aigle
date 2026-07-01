export interface TranslatorInput {
  errorCode: string
  providerName: string
  rawData?: Record<string, unknown>
}

export interface ClientError {
  code: string
  message: string
}

export type ProviderClientErrorMap = Record<string, ClientError>

const GENERIC_CLIENT_ERRORS: Record<string, ClientError> = {
  customer_insufficient_funds: { code: 'INSUFFICIENT_FUNDS', message: 'Solde insuffisant' },
  insufficient_funds: {
    code: 'MERCHANT_INSUFFICIENT_FUNDS',
    message: 'Solde marchand insuffisant',
  },
  invalid_destination: { code: 'INVALID_RECIPIENT', message: 'La destination est invalide' },
  invalid_msisdn: { code: 'INVALID_PHONE_NUMBER', message: 'Le numéro de téléphone est invalide' },
  unsupported_currency: {
    code: 'UNSUPPORTED_CURRENCY',
    message: "Cette devise n'est pas supportée",
  },
  fraud_suspicion: { code: 'FRAUD_SUSPICION', message: 'Refusé pour suspicion de fraude' },
  timeout: { code: 'EXPIRED_SESSION', message: 'Le délai a expiré' },
  canceled: { code: 'CANCELED', message: 'Opération annulée' },
  duplicate_request: {
    code: 'DUPLICATE_REQUEST',
    message: 'Une opération similaire est déjà en cours',
  },
  blacklisted_msisdn: {
    code: 'BLACKLISTED_NUMBER',
    message: 'Ce numéro est temporairement bloqué',
  },
}

const DEFAULT_CLIENT_ERROR: ClientError = {
  code: 'PROVIDER_REFUSED',
  message: 'Opération refusée par le fournisseur',
}

/**
 * Traduit un code d'erreur provider (natif) en erreur client-facing.
 * Priorité : code natif (rawData) → code d'erreur → table générique → défaut.
 */
export default class ErrorMessageTranslator {
  static translate(
    input: TranslatorInput,
    clientErrorMap: ProviderClientErrorMap = {}
  ): ClientError {
    const { errorCode, rawData } = input
    const nativeCode = ErrorMessageTranslator.extractNativeCode(rawData)

    if (nativeCode && clientErrorMap[nativeCode]) {
      return clientErrorMap[nativeCode]
    }

    if (clientErrorMap[errorCode]) {
      return clientErrorMap[errorCode]
    }

    return GENERIC_CLIENT_ERRORS[errorCode] ?? DEFAULT_CLIENT_ERROR
  }

  private static extractNativeCode(rawData?: Record<string, unknown>): string | null {
    if (!rawData) return null

    return (
      (rawData.error as string) ?? (rawData.code as string) ?? (rawData.errorCode as string) ?? null
    )
  }
}
