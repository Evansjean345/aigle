// app/shared/infrastructure/services/provider_error_service.ts

import { AdminAction, ErrorCategory, ProviderErrorCode } from '#shared/enums/provider_error_enums'

export interface ProviderErrorDefinition {
  code: ProviderErrorCode
  category: ErrorCategory
  isFinal: boolean
  adminAction: AdminAction
  userMessage: string
  adminMessage: string
}

const REGISTRY: Record<ProviderErrorCode, ProviderErrorDefinition> = {
  [ProviderErrorCode.INSUFFICIENT_FUNDS]: {
    code: ProviderErrorCode.INSUFFICIENT_FUNDS,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage:
      "Votre solde est insuffisant chez l'operateur. Veuillez recharger votre compte ou utiliser un autre moyen de paiement.",
    adminMessage: 'Solde insuffisant sur le compte operateur du client.',
  },

  [ProviderErrorCode.INVALID_PHONE_NUMBER]: {
    code: ProviderErrorCode.INVALID_PHONE_NUMBER,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'Le numero de telephone est invalide. Veuillez le verifier et reessayer.',
    adminMessage: 'Numero de telephone invalide soumis par le client.',
  },

  [ProviderErrorCode.INVALID_AMOUNT]: {
    code: ProviderErrorCode.INVALID_AMOUNT,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'Le montant saisi est invalide. Veuillez verifier le montant et reessayer.',
    adminMessage: 'Montant invalide soumis par le client.',
  },

  [ProviderErrorCode.INVALID_RECIPIENT]: {
    code: ProviderErrorCode.INVALID_RECIPIENT,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'Le destinataire est invalide ou non supporte. Veuillez verifier les coordonnes.',
    adminMessage: 'Destinataire invalide soumis par le client.',
  },

  [ProviderErrorCode.LIMIT_EXCEEDED]: {
    code: ProviderErrorCode.LIMIT_EXCEEDED,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage:
      'Le plafond de transaction de votre compte est depasse. Veuillez reessayer avec un montant inferieur.',
    adminMessage: 'Plafond de transaction depassé chez le provider.',
  },

  [ProviderErrorCode.RECIPIENT_NOT_ELIGIBLE]: {
    code: ProviderErrorCode.RECIPIENT_NOT_ELIGIBLE,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'Le destinataire ne peut pas recevoir ce paiement actuellement.',
    adminMessage: 'Destinataire non éligible selon le provider.',
  },

  [ProviderErrorCode.EXPIRED_SESSION]: {
    code: ProviderErrorCode.EXPIRED_SESSION,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'La session de paiement a expiré. Veuillez reessayer.',
    adminMessage: 'Session expirée coté provider.',
  },

  [ProviderErrorCode.CANCELED]: {
    code: ProviderErrorCode.CANCELED,
    category: ErrorCategory.USER_ERROR,
    isFinal: true,
    adminAction: AdminAction.NONE,
    userMessage: 'La transaction a été annulée.',
    adminMessage: 'Transaction annulée par le client ou le provider.',
  },

  [ProviderErrorCode.ACCOUNT_BLOCKED]: {
    code: ProviderErrorCode.ACCOUNT_BLOCKED,
    category: ErrorCategory.SECURITY,
    isFinal: true,
    adminAction: AdminAction.INVESTIGATE,
    userMessage: 'Votre compte est restreint. Veuillez contacter le support.',
    adminMessage: 'Compte client bloqué/suspendu chez le provider.',
  },

  [ProviderErrorCode.FRAUD_SUSPICION]: {
    code: ProviderErrorCode.FRAUD_SUSPICION,
    category: ErrorCategory.SECURITY,
    isFinal: true,
    adminAction: AdminAction.INVESTIGATE,
    userMessage: 'Transaction refusée pour des raisons de sécurité. Contactez le support.',
    adminMessage: 'Suspicion de fraude détectée par le provider.',
  },

  [ProviderErrorCode.BLACKLISTED_NUMBER]: {
    code: ProviderErrorCode.BLACKLISTED_NUMBER,
    category: ErrorCategory.SECURITY,
    isFinal: true,
    adminAction: AdminAction.INVESTIGATE,
    userMessage: 'Ce numero ne peut pas éffectuer cette operation.',
    adminMessage: 'Numero sur liste noire chez le provider.',
  },

  [ProviderErrorCode.PROVIDER_REFUSED]: {
    code: ProviderErrorCode.PROVIDER_REFUSED,
    category: ErrorCategory.PROVIDER_ERROR,
    isFinal: true,
    adminAction: AdminAction.INVESTIGATE,
    userMessage: 'Le service est momentanément indisponible. Veuillez reessayer plus tard.',
    adminMessage: 'Le provider a refusé la requête sans motif explicite.',
  },

  [ProviderErrorCode.PROVIDER_UNAVAILABLE]: {
    code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    category: ErrorCategory.PROVIDER_ERROR,
    isFinal: false,
    adminAction: AdminAction.MONITOR_PROVIDER,
    userMessage: 'Le service rencontre des difficultes techniques. Veuillez reessayer plus tard.',
    adminMessage: 'Service provider injoignable ou en maintenance.',
  },

  [ProviderErrorCode.RATE_LIMITED]: {
    code: ProviderErrorCode.RATE_LIMITED,
    category: ErrorCategory.PROVIDER_ERROR,
    isFinal: false,
    adminAction: AdminAction.MONITOR_PROVIDER,
    userMessage: 'Trop de tentatives. Veuillez patienter un instant.',
    adminMessage: 'AigleHub/Provider nous a rate-limit.',
  },

  [ProviderErrorCode.DUPLICATE_REQUEST]: {
    code: ProviderErrorCode.DUPLICATE_REQUEST,
    category: ErrorCategory.INTERNAL,
    isFinal: true,
    adminAction: AdminAction.ESCALATE,
    userMessage:
      'Une erreur technique est survenue. Veuillez reessayer plus tard ou contacter le support.',
    adminMessage: "Requete dupliquée détectée par le provider. Verifier la logique d'idempotence.",
  },

  [ProviderErrorCode.UNSUPPORTED_CURRENCY]: {
    code: ProviderErrorCode.UNSUPPORTED_CURRENCY,
    category: ErrorCategory.INTERNAL,
    isFinal: true,
    adminAction: AdminAction.ESCALATE,
    userMessage:
      'Une erreur technique est survenue. Veuillez reessayer plus tard ou contacter le support.',
    adminMessage: 'Dévise non supportée envoyée au provider. Verifier la configuration.',
  },

  [ProviderErrorCode.UNSUPPORTED_OPERATOR]: {
    code: ProviderErrorCode.UNSUPPORTED_OPERATOR,
    category: ErrorCategory.INTERNAL,
    isFinal: true,
    adminAction: AdminAction.ESCALATE,
    userMessage:
      'Une erreur technique est survenue. Veuillez reessayer plus tard ou contacter le support.',
    adminMessage: 'Opérateur non supporté envoyé au provider. Verifier la configuration.',
  },

  [ProviderErrorCode.INTERNAL_ERROR]: {
    code: ProviderErrorCode.INTERNAL_ERROR,
    category: ErrorCategory.INTERNAL,
    isFinal: false,
    adminAction: AdminAction.ESCALATE,
    userMessage: 'Une erreur technique est survenue. Veuillez reessayer dans quelques instants.',
    adminMessage: 'Erreur interne cote provider. Investigation technique requise.',
  },

  [ProviderErrorCode.UNKNOWN_ERROR]: {
    code: ProviderErrorCode.UNKNOWN_ERROR,
    category: ErrorCategory.INTERNAL,
    isFinal: false,
    adminAction: AdminAction.INVESTIGATE,
    userMessage:
      'Une erreur technique est survenue. Veuillez reessayer plus tard ou contacter le support.',
    adminMessage: 'Erreur inconnue recue du provider. Examiner les logs.',
  },
}

/**
 * Service de gestion des erreurs provider.
 */
export default class ProviderErrorService {
  /**
   * Resout un code d'erreur AigleHub en definition categorisee.
   */
  static resolve(code: string): ProviderErrorDefinition {
    const known = REGISTRY[code as ProviderErrorCode]
    if (known) return known

    // Fallback pour tout code inconnu
    return {
      code: ProviderErrorCode.UNKNOWN_ERROR,
      category: ErrorCategory.INTERNAL,
      isFinal: false,
      adminAction: AdminAction.INVESTIGATE,
      userMessage:
        'Une erreur technique est survenue. Veuillez reessayer plus tard ou contacter le support.',
      adminMessage: 'Code erreur non mappe recu du provider: ' + code,
    }
  }
}
