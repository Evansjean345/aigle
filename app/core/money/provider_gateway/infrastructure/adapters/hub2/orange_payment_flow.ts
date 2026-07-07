export type OrangePaymentMode = 'otp' | 'payment_link'

export function resolveOrangePaymentMode(payload: Record<string, any>): OrangePaymentMode {
  return payload.payment_mode === 'payment_link' ? 'payment_link' : 'otp'
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
 * Sélectionne la stratégie Orange à partir des `payment_details` persistés.
 * Seul un `payment_mode` explicitement égal à `payment_link` active le flux par
 * lien ; tout le reste retombe sur le flux OTP (mode par défaut).
 */
export function resolveOrangeFlow(paymentDetails: Record<string, any>): OrangePaymentFlow {
  return paymentDetails.payment_mode === 'payment_link'
    ? new OrangePaymentLinkFlow()
    : new OrangeOtpFlow()
}
