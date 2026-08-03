/**
 * Activité comptable d'un compte sur une période.
 *
 * Agrégée depuis le grand livre, seule source qui reflète les mouvements réellement écrits : une
 * somme calculée sur les transactions compterait aussi celles qui n'ont jamais abouti.
 */
export interface AccountActivityResult {
  /** Somme des crédits. */
  totalIn: number
  /** Somme des débits. */
  totalOut: number
  /** Somme des frais prélevés. */
  totalFees: number
  /** Nombre total d'écritures, entrées et sorties confondues. */
  transactionCount: number
  /** Nombre d'écritures au crédit — les encaissements. */
  inCount: number
  /** Nombre d'écritures au débit — les décaissements. */
  outCount: number
  /** Somme des mouvements des trente derniers jours, entrées et sorties confondues. */
  monthlyVolume: number
}
