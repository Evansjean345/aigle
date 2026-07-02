/*
 * Règles de frontières — consolidation core-feature (cf. apps/docs).
 *
 * REPORT-ONLY pour l'instant : toutes les règles sont en `severity: 'warn'`
 * (le codebase existant n'a pas été écrit avec ces règles). On resserrera
 * progressivement en `error`, feature par feature, une fois le socle stabilisé.
 *
 * NB résolution : depcruise ne mappe pas les subpath imports `#features/*` vers
 * les .ts (extensionAlias .js→.ts non supporté par son schéma). Les dépendances
 * restent donc sous la forme alias `#features/...`. On matche donc le `from` sur
 * le chemin réel (`app/features/...`, = la source du module) et le `to` sur la
 * forme alias (`#features/...`, = la cible résolue). aiglesend importe toujours
 * via `#features/*`, donc les règles se déclenchent bien.
 *
 * Couches (vers micro-services en couche — objectif d'indépendance) :
 *   - PRODUIT  : operations (consumer). [business à venir]
 *   - CORE     : tout le reste, dont :
 *       · identité : user · device · authentication · otp · kyc
 *       · argent   : money_movement · wallet · ledger · transactions · fees · provider_gateway
 *       · transverse : catalogs · country · qr · notifications · audit · webhooks · team
 * Invariant structurant (doc centrale §3.3) : le PRODUIT dépend du CORE, jamais l'inverse.
 */
const PRODUCT_FEATURES = ['operations']

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-ne-depend-pas-du-produit',
      comment:
        'Le CORE ne connaît jamais le PRODUIT : aucune feature core (ni transverse) ne doit ' +
        'importer une feature produit (operations). Condition de l’extractibilité en service.',
      severity: 'warn',
      from: {
        path: 'app/features/',
        pathNot: `app/features/(${PRODUCT_FEATURES.join('|')})/`,
      },
      to: {
        path: `#features/(${PRODUCT_FEATURES.join('|')})/`,
      },
    },
    {
      name: 'domaine-pur',
      comment: 'Le domaine ne dépend pas des autres couches (application/infra/présentation).',
      severity: 'warn',
      from: { path: 'app/features/[^/]+/domain' },
      to: { path: '#features/[^/]+/(application|infrastructure|presentation)' },
    },
    {
      name: 'application-sans-infra-ni-presentation',
      comment: "L'application ne dépend pas de l'infrastructure ni de la présentation.",
      severity: 'warn',
      from: { path: 'app/features/[^/]+/application' },
      to: { path: '#features/[^/]+/(infrastructure|presentation)' },
    },
    {
      name: 'presentation-sans-modeles-ni-infra',
      comment: 'La présentation passe par application, jamais directement domain/models ou infra.',
      severity: 'warn',
      from: { path: 'app/features/[^/]+/presentation' },
      to: { path: '#features/[^/]+/(domain/models|infrastructure)' },
    },
    {
      name: 'shared-sans-features',
      comment: "shared ne dépend d'aucune feature.",
      severity: 'warn',
      from: { path: 'app/shared' },
      to: { path: '#features/' },
    },
    {
      name: 'no-circular',
      comment: 'Pas de dépendance circulaire.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '(^|/)(node_modules|build|tests|\\.adonisjs)/' },
  },
}