import env from '#start/env'

/**
 * Reprise des organisations dont la configuration ne s'est pas achevée.
 *
 * Ces seuils arbitrent entre réactivité — rendre vite l'organisation utilisable à son propriétaire —
 * et bruit : ne pas reprendre une création encore en cours d'exécution. Pilotables par `.env` pour
 * être ajustés sans redéploiement.
 */

/** Cadence du balayage. Le job se réveille à cet intervalle (`start/scheduler.ts`). */
export const tickInterval = env.get('ORG_PROVISIONING_TICK_INTERVAL') ?? '5m'

/**
 * Âge à partir duquel une organisation en configuration est reprise.
 *
 * Doit rester supérieur à la durée normale d'une création, sinon le balayage doublonnerait une
 * requête encore en cours — sans danger, les étapes étant rejouables, mais sans utilité.
 */
export const staleAfterMinutes = Number(env.get('ORG_PROVISIONING_STALE_AFTER_MINUTES') ?? 5)

/** Au-delà, la configuration relève de la revue manuelle : le back-office la signale. */
export const reviewAfterMinutes = Number(
  env.get('ORG_PROVISIONING_REVIEW_AFTER_MINUTES') ?? 24 * 60
)

/** Nombre d'organisations traitées par tick, les plus anciennes d'abord. Borne la charge. */
export const batchLimit = Number(env.get('ORG_PROVISIONING_BATCH_LIMIT') ?? 25)
