/**
 * Enums métier du provider (catalogs) — concepts du domaine, indépendants de toute couche.
 * Le model et le port repository les référencent ; l'application/présentation les réutilise via
 * ré-export du DTO.
 */
export type ProviderType = 'mobile-money' | 'bank' | 'wallet'
export type ProviderStatus = 'active' | 'inactive'
