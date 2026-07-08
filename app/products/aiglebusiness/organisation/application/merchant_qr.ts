import { aigleplayPortailUrl } from '#config/app'

/**
 * Mise en forme du LIEN encodé dans le QR marchand — préoccupation PRODUIT
 * business : c'est l'app marchand (mobile + web) qui affiche le QR, et le lien
 * peut changer. On centralise donc le format ici, côté serveur business, pour
 * que tous les clients marchands partagent la même source.
 *
 *   <aigleplayPortailUrl>/<code>
 *
 * Le core ne possède que le `code` (alias payable) et sa résolution ; le lien de
 * la page de paiement aigleplay est du ressort du business. Base configurable
 * par déploiement via `config/app` (AIGLEPLAY_PORTAIL_URL).
 */

/** Construit le lien encodé dans le QR marchand à partir du code. */
export function formatMerchantQr(code: string): string {
  const base = aigleplayPortailUrl.replace(/\/+$/, '')
  return `${base}/${code}`
}
