import { type DeviceType } from '#core/identity/device/domain/enums'
import type AppVersion from '#core/identity/device/domain/models/app_version'

/**
 * Port de cache de version applicative. L'application dépend de ce contrat ;
 * l'infrastructure (AppVersionCacheService) en fournit l'implémentation.
 */
export default abstract class AppVersionCache {
  /**
   * Retourne la dernière version pour la plateforme, depuis le cache ou via la factory.
   *
   * @param platform Plateforme cible.
   * @param factory Fonction de repli lisant la source de vérité.
   */
  abstract getLatest(platform: DeviceType, factory: () => Promise<AppVersion | null>): Promise<any>

  /**
   * Invalide l'entrée de cache de la plateforme donnée.
   */
  abstract invalidate(platform: DeviceType): Promise<void>
}
