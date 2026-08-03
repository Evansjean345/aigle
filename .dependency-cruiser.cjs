/*
 * Règles de frontières — monolithe modulaire Aigle.
 *
 * NB résolution : depcruise ne mappe pas les subpath imports (`#core/*`, `#aiglesend/*`) vers les
 * .ts. On matche donc le `from` sur le chemin RÉEL du module source (`app/core/...`,
 * `app/products/...`) et le `to` sur la forme ALIAS résolue (`#core/...`, `#aiglesend/...`).
 *
 * Structure physique (Lot 5 + bounded contexts) :
 *   - PRODUIT    : app/products/<app>/<feature>/        (aiglesend : operations, qr ; aiglebusiness à venir)
 *   - CORE, en bounded contexts :
 *       · CONTEXTES MÉTIER : app/core/(money|identity|catalog)/<feature>/
 *           money    = money_movement · transactions · wallet · ledger · fees · risk · webhooks · provider_gateway
 *           identity = user · authentication · otp · device · kyc
 *           catalog  = catalogs · country
 *       · SUPPORTING (autonomes, dépendables par tous) : app/core/(audit|notifications|team|qr)/
 *
 * Invariants :
 *   1. Le PRODUIT dépend du CORE, jamais l'inverse (extractibilité du core).  [ERROR]
 *   2. Un contexte MÉTIER ne dépend pas d'un AUTRE contexte métier (frontière bounded context) —
 *      en cours de durcissement (#2/#3), donc WARN tant que les violations ne sont pas résorbées.
 *      L'intra-contexte est autorisé (money/transactions ↔ money/wallet). Les supporting sont
 *      dépendables librement.
 */

// Racine de feature (contient domain/application/infrastructure/presentation), quelle que soit la
// profondeur du contexte : money/identity/catalog ont 2 niveaux, supporting 1 niveau, produit 2.
const FEATURE_ROOT =
  '^app/(?:core/(?:money|identity|catalog)/[^/]+|core/(?:audit|notifications|team|qr)|products/[^/]+/[^/]+)'
// Cible alias, couche supérieure atteinte (peu importe la profondeur du contexte).
const TO_LAYER = '^#(?:core|aiglesend)/.+/'

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-ne-depend-pas-du-produit',
      comment:
        'Le CORE (et shared) ne connaît jamais le PRODUIT : aucun module core/shared ne doit ' +
        'importer une feature produit (#aiglesend|#aiglebusiness). Condition de l’extractibilité.',
      severity: 'error',
      from: { path: '^app/(core|shared)/' },
      to: { path: '^#(aiglesend|aiglebusiness)/' },
    },

    {
      name: 'produit-consomme-core-par-service',
      comment:
        'Un PRODUIT ne consomme le CORE que via ses application/services (ports) et DTOs — ' +
        'jamais ses repositories, modèles de domaine ou infrastructure. Communication par ' +
        'service, contrat minimal (anti-corruption). Ex : passer par UserDirectoryService / ' +
        'CountryDirectoryService, pas par le repository / le modèle. Invariant (0 violation).',
      severity: 'error',
      from: { path: '^app/products/.*/(application|domain)/' },
      to: {
        path: '^#core/.*/(domain/models/|domain/interfaces/[^/]*repository|infrastructure/)',
      },
    },

    {
      name: 'identity-authentification-ne-depend-pas-de-team',
      comment:
        "La feature identity/authentication (PRIMARY : identité user aiglesend) ne dépend pas du " +
        'support team. L’auth admin a été déplacée dans core/team/authentication. Invariant (0 violation).',
      severity: 'error',
      from: { path: '^app/core/identity/authentication/' },
      to: { path: '^#core/team/' },
    },

    // ── Frontières inter-contexte métier (WARN : durcissement #2/#3 en cours) ──
    //
    // Décision d'architecture (2026-07-07) :
    //  · SHARED KERNEL STRUCTUREL : les MODÈLES de domaine (domain/models) forment un noyau
    //    partagé assumé — les relations Lucid inter-contexte (User↔Transaction/Wallet, FK +
    //    preloads, atomicité) sont légitimes. On exempte donc `from: domain/models`. Seules
    //    les couches application/infra/présentation respectent la frontière stricte (à résorber
    //    par ID/contrat, cf. OperationActor, IdentityGate.authorize(userId)).
    //  · catalog = RÉFÉRENTIEL / shared kernel en LECTURE : pays, catalogue provider sont de la
    //    donnée de référence lisible par tout contexte. La règle money/identity ⇏ catalog est
    //    donc RETIRÉE. On garde l'inverse (catalog ⇏ money/identity) : le référentiel reste
    //    autonome et ne connaît pas les contextes métier.
    {
      name: 'money-independant-de-identity',
      comment:
        'La couche non-domaine de money ne dépend pas du contexte identity (frontière bounded ' +
        'context). À résorber par ID/contrat. Les domain/models sont exemptés (shared kernel).',
      severity: 'warn',
      from: { path: '^app/core/money/', pathNot: '/domain/models/' },
      to: { path: '^#core/identity/' },
    },
    {
      name: 'identity-independant-de-money',
      comment:
        'La couche non-domaine de identity ne dépend pas du contexte money. Les domain/models ' +
        'sont exemptés (shared kernel structurel, relations Lucid inverses).',
      severity: 'warn',
      from: { path: '^app/core/identity/', pathNot: '/domain/models/' },
      to: { path: '^#core/money/' },
    },
    {
      name: 'catalog-independant-des-contextes-metier',
      comment:
        'Le référentiel catalog ne dépend pas de money/identity (autonomie du référentiel). ' +
        'NB : l’inverse est autorisé — catalog est un shared kernel lisible par tous.',
      severity: 'warn',
      from: { path: '^app/core/catalog/' },
      to: { path: '^#core/(money|identity)/' },
    },

    // ── Couches DDD (WARN : durcissement en cours) ──
    {
      name: 'domaine-pur',
      comment: 'Le domaine ne dépend pas des autres couches (application/infra/présentation).',
      severity: 'warn',
      from: { path: `${FEATURE_ROOT}/domain` },
      to: { path: `${TO_LAYER}(application|infrastructure|presentation)/` },
    },
    {
      name: 'application-sans-infra-ni-presentation',
      comment:
        "L'application ne dépend pas de l'infrastructure ni de la présentation. " +
        'EXEMPTION étroite : un DTO applicatif peut IMPORTER-TYPE le validator Vine de ' +
        'présentation dont il dérive la forme du payload (Infer<typeof validator>) — le schéma ' +
        'Vine est la source de vérité du contrat de payload HTTP, le couplage reste type-only ' +
        '(aucune dépendance runtime). Toute autre dépendance vers presentation/ ou infrastructure/ ' +
        'reste interdite.',
      severity: 'warn',
      from: { path: `${FEATURE_ROOT}/application` },
      to: {
        path: `${TO_LAYER}(infrastructure|presentation)/`,
        pathNot: '/presentation/.*/validators/',
      },
    },
    {
      name: 'presentation-sans-modeles-ni-infra',
      comment: 'La présentation passe par application, jamais directement domain/models ou infra.',
      severity: 'warn',
      from: { path: `${FEATURE_ROOT}/presentation` },
      to: { path: `${TO_LAYER}(domain/models|infrastructure)/` },
    },

    {
      name: 'transaction-portee-par-le-service',
      comment:
        "Un use case ou une présentation n'ouvre pas de transaction de base : l'atomicité " +
        "appartient au service qui écrit, ou au repository. Ouvrir une transaction depuis " +
        "l'appelant grave une décision de persistance dans une couche qui ne devrait connaître " +
        "que des contrats — et le jour où le service passe derrière une API, la transaction ne " +
        'traverse pas le réseau. Invariant non couvert par `produit-consomme-core-par-service`, ' +
        'qui ne filtre que les imports `#core/…` : `db` vient du package Lucid.',
      severity: 'warn',
      from: { path: `${FEATURE_ROOT}/(application/use_?cases|presentation)/` },
      to: { path: '^@adonisjs/lucid/services/db$' },
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
