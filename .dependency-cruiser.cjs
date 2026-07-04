/*
 * Règles de frontières — monolithe modulaire Aigle (couches physiques core / products).
 *
 * NB résolution : depcruise ne mappe pas les subpath imports (`#core/*`, `#aiglesend/*`) vers les
 * .ts. On matche donc le `from` sur le chemin réel du module source (`app/core/...`,
 * `app/products/...`) et le `to` sur la forme alias résolue (`#core/...`, `#aiglesend/...`).
 *
 * Couches (séparation PHYSIQUE, Lot 5 — objectif d'indépendance / extractibilité) :
 *   - CORE     : app/core/<feature>/            (plateforme partagée, extractible)
 *       · identité : user · device · authentication · otp · kyc
 *       · argent   : money_movement · wallet · ledger · transactions · fees · provider_gateway
 *       · transverse : catalogs · country · notifications · audit · webhooks · team
 *   - PRODUIT  : app/products/<app>/<feature>/  (aiglesend : operations, qr ; aiglebusiness à venir)
 * Invariant structurant : le PRODUIT dépend du CORE, jamais l'inverse (condition d'extractibilité).
 *
 * Racines de couche pour les règles DDD (core = 1 niveau, produit = 2 niveaux app/feature) :
 *   from réel  : app/(core/[^/]+|products/[^/]+/[^/]+)
 *   to alias   : #(core|aiglesend)/[^/]+
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-ne-depend-pas-du-produit',
      comment:
        'Le CORE (et shared) ne connaît jamais le PRODUIT : aucun module core/shared ne doit ' +
        'importer une feature produit (app/products/**, alias #aiglesend|#aiglebusiness). ' +
        'Condition de l’extractibilité du core en service/librairie.',
      severity: 'error',
      from: { path: '^app/(core|shared)/' },
      to: { path: '^#(aiglesend|aiglebusiness)/' },
    },
    {
      name: 'domaine-pur',
      comment: 'Le domaine ne dépend pas des autres couches (application/infra/présentation).',
      severity: 'warn',
      from: { path: '^app/(core/[^/]+|products/[^/]+/[^/]+)/domain' },
      to: { path: '^#(core|aiglesend)/[^/]+/(application|infrastructure|presentation)' },
    },
    {
      name: 'application-sans-infra-ni-presentation',
      comment: "L'application ne dépend pas de l'infrastructure ni de la présentation.",
      severity: 'warn',
      from: { path: '^app/(core/[^/]+|products/[^/]+/[^/]+)/application' },
      to: { path: '^#(core|aiglesend)/[^/]+/(infrastructure|presentation)' },
    },
    {
      name: 'presentation-sans-modeles-ni-infra',
      comment: 'La présentation passe par application, jamais directement domain/models ou infra.',
      severity: 'warn',
      from: { path: '^app/(core/[^/]+|products/[^/]+/[^/]+)/presentation' },
      to: { path: '^#(core|aiglesend)/[^/]+/(domain/models|infrastructure)' },
    },
    {
      name: 'shared-sans-couches',
      comment: "shared ne dépend d'aucune feature (core ou produit).",
      severity: 'warn',
      from: { path: '^app/shared' },
      to: { path: '^#(core|aiglesend|aiglebusiness)/' },
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