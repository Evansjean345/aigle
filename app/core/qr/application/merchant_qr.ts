import env from '#start/env'

/**
 * Le QR marchand encode un LIEN vers la page de paiement aigleplay :
 *
 *   <AIGLEPLAY_BASE_URL>/<code>
 *
 * Scanné (depuis n'importe quelle caméra), il ouvre la page où le payeur choisit
 * un mobile money OU Aiglesend (§ page de checkout). Le `code` identifie l'alias
 * payable ; la page le résout côté serveur pour afficher le marchand.
 *
 * La base est configurable par déploiement (AIGLEPLAY_BASE_URL) ; défaut de repli
 * pour dev/test.
 */
const DEFAULT_AIGLEPLAY_BASE_URL = 'https://pay.aigle'

/** Construit le lien encodé dans le QR marchand à partir du code. */
export function formatMerchantQr(code: string): string {
  const base = (env.get('AIGLEPLAY_BASE_URL') ?? DEFAULT_AIGLEPLAY_BASE_URL).replace(/\/+$/, '')
  return `${base}/${code}`
}
