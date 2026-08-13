import env from '#start/env'
import adonisApp from '@adonisjs/core/services/app'

/**
 * Appareils : combien un compte peut en lier, et ce qui les rend acceptables.
 */

/** Nombre d'appareils qu'un compte peut lier simultanément. */
export const maxDeviceConnectionAllowed: number = env.get('MAX_DEVICE_CONNECTIONS', 2)

/**
 * Refuse les appareils rootés ou émulés.
 *
 * Actif en production par défaut, inactif ailleurs : le refus rendrait tout travail sur émulateur
 * impossible. Le réglage rend la décision explicite et permet de vérifier la garde — en test, ou
 * sur un environnement de recette avant mise en production.
 */
export const enforceIntegrity =
  env.get('DEVICE_ENFORCE_INTEGRITY') !== undefined
    ? env.get('DEVICE_ENFORCE_INTEGRITY') === 'true'
    : adonisApp.inProduction
