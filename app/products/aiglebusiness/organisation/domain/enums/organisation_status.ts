/**
 * Statut de cycle de vie d'une organisation.
 *
 * `PROVISIONING` est l'état d'une organisation dont la configuration n'est pas achevée : son compte
 * ou son alias d'encaissement manquent encore. Les routes scopées la refusent comme une
 * organisation bloquée, mais pour une raison opposée — elle n'est pas encore prête, non suspendue.
 */
export enum OrganisationStatus {
  PROVISIONING = 'provisioning',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
