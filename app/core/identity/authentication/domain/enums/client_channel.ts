/**
 * Canal client d'une session (mobile app vs portail web). Valeur neutre (comme
 * `AppName`) : le core l'héberge pour la stamper sur le token (`channel:<name>`) et
 * l'exposer dans les sessions. L'ENFORCEMENT (exiger un device selon le canal) vit,
 * lui, dans un middleware propre au produit qui en a besoin (business).
 */
export enum ClientChannel {
  MOBILE = 'mobile',
  WEB = 'web',
}

/** Header par lequel le client déclare son canal. */
export const CLIENT_CHANNEL_HEADER = 'X-Client-Channel'

/** Préfixe de l'ability portée par le token pour marquer le canal. */
export const CHANNEL_ABILITY_PREFIX = 'channel:'

/** Ability à stocker pour un canal (ex : `channel:mobile`). */
export function channelAbility(channel: ClientChannel): string {
  return `${CHANNEL_ABILITY_PREFIX}${channel}`
}

/** Vrai si la valeur est un canal reconnu. */
export function isValidChannel(value: string): value is ClientChannel {
  return value === ClientChannel.MOBILE || value === ClientChannel.WEB
}
