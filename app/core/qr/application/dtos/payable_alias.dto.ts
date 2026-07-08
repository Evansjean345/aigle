// ── Result (output service) ─────────────────────────────────────────

/**
 * Résolution d'un alias payable renvoyée par PayableAliasService.resolve (ce que
 * le core fournit au scan d'un QR marchand).
 */
export interface ResolveAliasResult {
  accountId: string
  displayName: string
  active: boolean
}
