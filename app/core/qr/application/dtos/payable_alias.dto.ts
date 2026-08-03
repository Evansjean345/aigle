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

/** Alias payable d'un compte, tel que le voit l'espace admin. */
export interface PayableAliasResult {
  code: string
  /** Nom montré au payeur au moment du scan. */
  displayName: string
  /** `false` fait refuser tout paiement présentant ce code. */
  active: boolean
}
