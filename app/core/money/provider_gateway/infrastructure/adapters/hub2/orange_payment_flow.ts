export type OrangePaymentMode = 'otp' | 'payment_link'

/**
 * Résout le mode Orange. **Défaut = `payment_link`** (redirection) : l'OTP sera déprécié,
 * il faut le demander explicitement (`payment_mode === 'otp'`).
 */
export function resolveOrangePaymentMode(payload: Record<string, any>): OrangePaymentMode {
  return payload.payment_mode === 'otp' ? 'otp' : 'payment_link'
}

/**
 * Stratégie d'un flux de paiement Orange : sait construire le bloc `mobileMoney`
 * envoyé à Hub2 et indiquer si le flux nécessite un polling de l'URL de redirection.
 */
export interface OrangePaymentFlow {
  apply(mobileMoney: Record<string, any>, paymentDetails: Record<string, any>): void
  requiresRedirectPolling(): boolean
}

class OrangeOtpFlow implements OrangePaymentFlow {
  apply(mobileMoney: Record<string, any>, paymentDetails: Record<string, any>): void {
    mobileMoney.otp = paymentDetails.otp
  }

  requiresRedirectPolling(): boolean {
    return false
  }
}

class OrangePaymentLinkFlow implements OrangePaymentFlow {
  apply(mobileMoney: Record<string, any>, paymentDetails: Record<string, any>): void {
    mobileMoney.workflow = 'redirection'
    mobileMoney.onCancelRedirectionUrl = paymentDetails.error_url
    mobileMoney.onFinishRedirectionUrl = paymentDetails.success_url
  }

  requiresRedirectPolling(): boolean {
    return true
  }
}

/**
 * Sélectionne la stratégie Orange. **Défaut = flux par lien (`payment_link`)** : l'OTP est
 * en voie de dépréciation → il n'est appliqué que si `payment_mode === 'otp'` explicite.
 */
export function resolveOrangeFlow(paymentDetails: Record<string, any>): OrangePaymentFlow {
  return paymentDetails.payment_mode === 'otp' ? new OrangeOtpFlow() : new OrangePaymentLinkFlow()
}
