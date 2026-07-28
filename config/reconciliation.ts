import env from '#start/env'

/**
 * Réconciliation des mouvements externes orphelins (B6, L2-D17).
 *
 * Ces seuils arbitrent entre **réactivité** (rattraper vite un webhook perdu, donc libérer les fonds
 * immobilisés) et **bruit** (ne pas interroger l'agrégateur pour des mouvements parfaitement sains).
 * Pilotables par `.env` pour être ajustés sans redéploiement — notamment en cas d'incident opérateur.
 */

/** Cadence du balayage. Le job se réveille à cet intervalle ('start/scheduler.ts'). */
export const tickInterval = env.get('RECONCILE_TICK_INTERVAL') ?? '5m'

/**
 * Sans nouvelle de l'opérateur depuis ce délai, on va la chercher.
 * Doit rester nettement supérieur au délai normal d'un webhook (secondes à minutes), sinon on
 * pollerait des mouvements sains.
 */
export const staleAfterMinutes = Number(env.get('RECONCILE_STALE_AFTER_MINUTES') ?? 20)

/** Au-delà, un mouvement toujours irrésolu relève de la revue manuelle (L2-D18). */
export const reviewAfterMinutes = Number(env.get('RECONCILE_REVIEW_AFTER_MINUTES') ?? 24 * 60)

/** Nombre de mouvements traités par tick (les plus anciens d'abord). Borne la charge d'un passage. */
export const batchLimit = Number(env.get('RECONCILE_BATCH_LIMIT') ?? 50)
