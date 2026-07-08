export const MERCHANT_QR_SCHEME = 'aiglepay:merchant:'

/** Construit le payload complet encodé dans le QR marchand à partir du code. */
export function formatMerchantQr(code: string): string {
  return `${MERCHANT_QR_SCHEME}${code}`
}
