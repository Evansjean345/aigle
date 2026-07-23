/**
 * Gouverneur de débit d'égress (token bucket, voie **batch** — L2-D9). Devant Hub2 `POST /transfers`,
 * la limite est **par IP** (~7/s). Le relais demande des tokens ; il ne dispatch que ce que le budget
 * autorise → le mass ne dépasse jamais la limite (zéro 429).
 *
 * MVP : voie **batch-only** (le chemin interactif consumer n'est pas touché). Le gouverneur **partagé**
 * interactif/batch (priorité) = durcissement B4b+ (différé).
 */
export default abstract class TransferRateGovernor {
  /**
   * Tente d'acquérir jusqu'à `max` tokens. Retourne le nombre **réellement** accordé (0..max) selon
   * l'état du seau (rechargé à débit constant, plafonné à sa capacité). Atomique (multi-worker).
   */
  abstract tryAcquire(max: number): Promise<number>
}
