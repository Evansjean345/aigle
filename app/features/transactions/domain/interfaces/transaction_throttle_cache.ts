import { DateTime } from 'luxon'

export default abstract class TransactionThrottleCache {
  /**
   * Enregistre la date du dernier succès pour un utilisateur
   */
  abstract setLastSuccessTime(userId: string, timestamp?: Date | string | DateTime): Promise<void>

  /**
   * Récupère la date du dernier succès
   */
  abstract getLastSuccessTime(userId: string): Promise<DateTime | null>

  /**
   * Vérifie si l'utilisateur doit attendre avant de refaire un transfert
   * @throws {TransferThrottleException} si l'intervalle est < 1 minute
   */
  abstract verifyThrottle(userId: string): Promise<void>
}
