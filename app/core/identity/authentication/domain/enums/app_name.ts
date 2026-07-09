/**
 * Applications produit reconnues par l'authentification core. Valeur neutre (pas
 * de couplage vers les modules produit) : sert à stamper le token
 * (`app:<name>`) et à cloisonner l'accès par produit (middleware `requireApp`).
 */
export enum AppName {
  AIGLESEND = 'aiglesend',
  AIGLEBUSINESS = 'aiglebusiness',
}

/** Préfixe de l'ability portée par le token pour marquer l'app d'émission. */
export const APP_ABILITY_PREFIX = 'app:'

/** Ability à stocker/rechercher pour une app donnée (ex : `app:aiglebusiness`). */
export function appAbility(app: AppName): string {
  return `${APP_ABILITY_PREFIX}${app}`
}
