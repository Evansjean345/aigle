---
status: approved
etape: 5
lot: L1
lots_approuves: L1
derniere_maj: 2026-07-31
---

# Permissions du back-office — règles de définition, configuration et mise en place

Réponse au chantier **R1** (`docs/plans/remarques-a-brainstormer.md`, 🔴 Critique) : « Permissions du
RBAC team créées en CRUD par l'admin au lieu d'être déclarées en code ». Mode **large projet**
(plusieurs modules, schéma de données, RBAC en production, front à aligner).

Prompt de cadrage : `docs/plans/2026-07-30-rbac-permissions-prompt.md`.

## Contexte (exploré 2026-07-30)

État vérifié dans le code, pas repris de la revue précédente.

### Six mécanismes coexistent pour déclarer ou vérifier une permission

| # | Mécanisme | Où | Exemple |
|---|---|---|---|
| 1 | Catalogue en code, par feature (objet TS, sans métadonnées) | `*/presentation/admin/permissions.config.ts` (4 fichiers : `ledger`, `transactions`, `wallet`, `audit`) | `LEDGER_PERMISSIONS.ledgersRead` |
| 2 | Catalogue en code, métier, avec métadonnées + validation | `aiglebusiness/membership/domain/permissions.config.ts` | 11 permissions, `sensitive`, `isValidPermissionSlug`, `assertValidPermissions` |
| 3 | Slug littéral en dur dans une policy | `identity/kyc/presentation/admin/policies/kyc_policy.ts` | `adminHasPermission(user, 'kyc.read')` |
| 4 | Slug écrit dans un seeder, sans catalogue | `database/seeders/*_seeder.ts` | `funding_requests.*`, `mass_transfers.read`, `organisations.*`, `collection_accounts.*`, `funding_settings.manage` |
| 5 | CRUD à l'exécution par l'admin | `core/team/application/use_cases/permissions/` + `permission_management_controller` | c'est l'objet de R1 |
| 6 | Énumération TypeScript du front, par layer | `apps/aiglesend/admin/app/layers/*/permissions.ts` (11 fichiers) | `UserPermissions.USERS_READ` |

### Deux styles d'enforcement côté serveur

- **Bouncer policy** dans le contrôleur (`bouncer.with(XPolicy).authorize('...')`) → `adminHasPermission` :
  `audit`, `kyc`, `ledger`, `transactions`, `wallet`.
- **Middleware de route** (`middleware.permission([...])`) : `team`, `funding`, `collection_accounts`,
  `organisations`, `mass_transfers`.

Les deux contournent pour le slug de rôle **`root`** (`permission_helpers.ts:13`,
`permission_middleware.ts:22`).

### Zones admin sans aucune garde de permission

Vérifié : `middleware.permission` absent **et** aucune policy bouncer.

| Zone | Fichier de routes | Ce qui est exposé au premier admin authentifié venu |
|---|---|---|
| Utilisateurs | `identity/user/presentation/admin/routes/users_route.ts` | liste, détail, blocage, reset de mot de passe |
| Appareils | `identity/device/.../admin_device_routes.ts` | révocation d'appareil, appareil principal |
| Versions d'app | `identity/device/.../app_version_routes.ts` | publication de version |
| Catalogue | `catalog/catalogs/.../services_management_routes.ts` | services, providers, tarifs |

Seul `middleware.auth({guards:['admin']})` s'applique. Le front, lui, garde ces pages derrière
`user.read`, `user.block`, `user_password.reset`, `app_versions.read`, `services.read`… — des slugs
que **le serveur ne vérifie jamais**. La garde est donc purement cosmétique : l'API répond à
n'importe quel rôle.

### Dérive mesurée (2026-07-30)

**14 permissions exigées par le serveur et semées nulle part** (la revue précédente en comptait 11 —
les 3 `kyc.*` manquaient) :

```
kyc.read            ledger.read           transaction.read           user_transactions.read
kyc.approve         ledgers.read          transactions.read          user_transactions_report.read
kyc.reject          ledgers_report.read   transactions_report.read
                    user_ledgers.read     transaction_ledger.read
                    user_ledgers_report.read
```

**4 permissions semées et vérifiées nulle part** (fantômes) : `finance.view`, `kyc.manage`,
`support.access`, `users.manage`. Elles composent pourtant les rôles `admin`, `kyc_agent`,
`support_agent` — ces trois rôles n'ouvrent donc, en pratique, **aucune** porte serveur.

**~26 slugs déclarés uniquement par le front**, ni semés ni vérifiés : `user.*`, `user_wallet.*`,
`user_device*`, `users.read`, `user_password.reset`, `organisation.read/block`,
`organisation_members.read`, `organisation_wallet.read`, `organisation_transactions.read`,
`organisation_kyb.read`, `services.read`, `providers.read`, `pricings.read`, `app_versions.read`,
`members.read`, `roles.read`, `permissions.read`, `kyc.agent_view`.

**Hypothèse à confirmer en base** : ces slugs front n'existant dans aucun seeder, les pages
correspondantes seraient inaccessibles à tout le monde — sauf si un administrateur les a
**créés à la main via le CRUD** en production. Ce serait l'explication de l'existence du CRUD (#5) :
il compense l'absence de catalogue. À vérifier avant de retirer le CRUD.

### Le rôle tout-puissant : trois noms pour deux choses

| Composant | Slug privilégié |
|---|---|
| `permission_helpers.ts`, `permission_middleware.ts` | `root` |
| `admin_otp_attempt_guard.ts` (`SUPER_ADMIN_SLUG`) | `root` |
| `admin_attempt_guard.ts` (`SUPER_ADMIN_SLUG`) | **`super_admin`** |
| `role_permission_seeder.ts` | crée `super_admin`, `admin`, `kyc_agent`, `finance_admin`, `support_agent` — **pas `root`** |
| `commands/make_root_role.ts` | crée `root` et lui attache **toutes** les permissions de la table |
| `commands/create_super_admin.ts` | cherche `Role.findBy('slug','root')` pour le premier compte |
| Seeders de feature (`funding`, `organisation`, `mass_transfer`, `collection_account`) | rattachent à **`super_admin`** |

Les deux gardes de tentatives (mot de passe / OTP) ne protègent donc pas le même rôle : le compte
bootstrap est `root`, mais l'exemption de blocage permanent sur échecs de mot de passe vise
`super_admin`. Un compte `root` peut être bloqué définitivement par force brute ; un `super_admin`
non — alors qu'il n'a aucun pouvoir particulier.

Côté front, `usePermissions.isSuper` teste `permissions.includes("all")` — un slug que l'API
**n'émet jamais** (`AdminResponseDto.role.permissions: string[]`, alimenté par la table). Le
contournement `root` n'existe donc pas côté front : un `root` ne voit que les pages dont les slugs
sont réellement en base.

### Contraintes d'architecture qui pèsent sur le design

- `core-ne-depend-pas-du-produit` est en **erreur** depcruise : un catalogue central vivant dans
  `app/core/team/` **ne peut pas** importer les permissions des features produit (`funding`,
  `organisation`, `mass`). Un point d'agrégation doit vivre hors de `app/` (`start/`, `commands/`,
  `database/`) — ces répertoires ne matchent aucune règle `from:` et peuvent tout importer.
- `produit-consomme-core-par-service` (erreur, 0 violation) doit rester à 0.
- Deux conventions de nommage cohabitent : `a.b` (back-office, `ledgers.read`) et `a:b` (business,
  `transfer:approve`), avec des doublons singulier/pluriel (`ledger.read` **et** `ledgers.read`,
  `transaction.read` **et** `transactions.read`).
- RBAC **en production** : rôles, permissions et affectations existent déjà en base.

### Zones de risque

1. Retirer le CRUD sans savoir ce qui a été créé à la main en prod ⇒ perte d'accès pour des rôles réels.
2. Renommer/normaliser des slugs ⇒ casse les `role_permission` existants et les gardes du front.
3. Unifier `root`/`super_admin` ⇒ touche l'authentification admin (gardes de blocage) et le bootstrap.
4. Poser des gardes là où il n'y en a pas (users, devices, catalogue) ⇒ un rôle qui accédait de fait
   à ces pages se voit refusé du jour au lendemain.

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| D1 | **Périmètre : catalogue en code + retrait du CRUD + outillage anti-dérive + pose des gardes manquantes** sur les 4 zones admin non protégées (utilisateurs, appareils, versions d'app, catalogue). | (a) Catalogue + anti-dérive seuls, les zones sans garde renvoyées à une remarque R11 ; (b) catalogue seul, sans outillage de vérification. | Une permission déclarée en code n'a de valeur que si un endpoint la vérifie. Laisser 4 zones admin ouvertes à tout admin authentifié — dont le blocage d'utilisateur et le reset de mot de passe — reviendrait à clore R1 en laissant intacte la faille qu'elle décrit. | 2026-07-30 |
| D2 | **Normalisation des slugs avec migration** : une convention unique est tranchée, les slugs non conformes sont renommés, et une migration met à jour `permissions` + `role_permission` en base. | (a) Compatibilité stricte (garder l'existant tel quel, doublons compris) ; (b) normalisation en deux temps via alias transitoires. | Le nommage incohérent est une des causes de la dérive ; le figer par compatibilité reviendrait à la pérenniser. Le mécanisme d'alias coûterait un dispositif temporaire que personne ne retirerait. Contrepartie assumée : déploiement API + front coordonné. | 2026-07-30 |
| D3 | **La granularité passe par l'action, pas par le nombre grammatical.** Ressource toujours au pluriel ; `read` = consulter une pièce, `list` = parcourir la collection, `export` = extraire un rapport. Chaque entrée du catalogue porte un **libellé et une description obligatoires** (comme `BUSINESS_PERMISSIONS`), c'est eux que lit l'admin qui compose un rôle. | (a) Pluriel = collection / singulier = unité (l'usage actuel des transactions) ; (b) portée en suffixe (`read` / `read_all`). | La distinction liste/détail est un vrai contrôle (un agent support ouvre une transaction sans accéder au registre), mais un `s` ne la porte pas : `transaction.read` et `transactions.read` sont indiscernables à la relecture. Preuve au dossier : `authorize('viewUserTansactionsReport' as never)` a traversé compilation, revue et déploiement. Par ailleurs la règle n'était honorée que par les transactions — `ledger.read` est déclaré et vérifié nulle part. | 2026-07-30 |
| D4 | **Granularité maximale assumée** : on décompose au plus fin, chaque geste distinct du back-office est une permission distincte, y compris pour une ressource consultée dans un contexte restreint (les transactions d'un utilisateur ≠ le registre global). | Un catalogue resserré de permissions larges, plus simple à composer. | Plate-forme fintech : plus le catalogue est fin, plus il y a de décisions d'accès possibles, donc de séparation des tâches réelle. **Contrepartie à traiter dans le design** : sans aide à la composition, un catalogue fin pousse à tout cocher — d'où modèles de rôles livrés en code, drapeau `sensitive`, et incompatibilités déclarées (ex. `funding_settings.manage` × `funding_requests.review`). | 2026-07-30 |
| D5 | **Slug à trois segments : `[<contexte>.]<ressource>.<action>`**, tout au pluriel. Le contexte n'apparaît que lorsqu'un droit restreint doit pouvoir être accordé sans le droit global (`users.transactions.list` ≠ `transactions.list`). | (a) Préfixe collé à deux segments, l'existant (`user_transactions.read`) ; (b) pas de permission composée du tout. | Le contexte devient un segment manipulable : le catalogue se groupe par premier segment (« Registre global », « Fiche utilisateur », « Fiche organisation ») sans code de regroupement dédié, là où `user_transactions` obligerait à redécouper la chaîne sur l'underscore. | 2026-07-30 |
| D6 | **L1 — catalogue par feature avec slugs marqués** : `definePermissions` produit des slugs de type nominal ; `adminHasPermission` et le middleware n'acceptent que ce type, un littéral ne compile plus. | (a) Catalogue central unique dans `core/team` ; (b) registre auto-enregistré au boot. | Seule approche qui rend la chaîne magique impossible à la compilation tout en laissant chaque feature propriétaire de ses permissions (extractibilité, cohérence avec `membership`). Le registre au boot priverait L2 de sa garantie statique. | 2026-07-30 |
| D7 | **Agrégat dans `start/permissions.ts`.** | (a) `database/permissions_catalog.ts` ; (b) `config/permissions.ts`. | `start/` assemble déjà core et produit (`routes.ts`, `kernel.ts`) et échappe aux règles depcruise dont le `from:` cible `^app/`. Ouvre la porte à un échec au démarrage sur écart (à trancher en L2). `config/` suggérerait à tort un réglage par environnement. | 2026-07-30 |
| D8 | **`start/permissions.ts` est ajouté aux `preloads`** d'`adonisrc.ts`. | Le laisser hors preloads, chargé seulement par la commande et les tests. | Sans cela, l'agrégat n'est jamais chargé au démarrage : l'échec sur slug dupliqué n'arriverait pas au boot et la garantie annoncée serait fausse en production. Coût nul — c'est un module de constantes. | 2026-07-31 |

## Objectif

On construit un **catalogue de permissions du back-office déclaré en code**, source de vérité
unique et décomposée au plus fin, à partir duquel l'administrateur ne compose plus que des
**rôles** — **pour** clore R1 (permissions créées à l'exécution, contrôles d'accès orphelins) et
fermer les zones admin aujourd'hui sans garde. **C'est réussi si** :

1. toute permission vérifiée par le code existe au catalogue et en base, et réciproquement ;
2. tout écart entre code, catalogue et base fait échouer une vérification automatique, sans
   intervention humaine ;
3. aucun endpoint admin n'est accessible sans permission explicite ;
4. le front ne peut plus garder une page derrière un slug que le serveur ignore.

## Convention de nommage (D3 + D4 + D5)

```
[<contexte>.]<ressource>.<action>
```

- **`<ressource>`** — toujours au pluriel : `transactions`, `ledgers`, `users`, `wallets`,
  `devices`, `organisations`, `roles`…
- **`<action>`** — verbe explicite. Lecture : `read` (une pièce), `list` (la collection),
  `export` (un rapport). Écriture : `create`, `update`, `delete`, ou un verbe métier
  (`approve`, `reject`, `block`, `refund`, `adjust`, `revoke`).
- **`<contexte>`** — présent uniquement quand le droit restreint doit pouvoir être accordé sans
  le droit global. Au pluriel lui aussi.

Exemple cible (extrait) :

```
transactions.read              Consulter une transaction
transactions.list              Parcourir tout le registre
transactions.export            Extraire un rapport
transactions.refund            Rembourser
transactions.ledgers.read      Voir les écritures d'une transaction

users.read                     Consulter une fiche utilisateur
users.list                     Parcourir l'annuaire
users.block                    Bloquer un utilisateur
users.transactions.list        Ses transactions
users.transactions.export      Son rapport de transactions
users.ledgers.list             Ses écritures
users.wallets.read             Son solde
users.wallets.adjust           Ajuster son solde
users.devices.list             Ses appareils
users.devices.revoke           Révoquer un appareil

organisations.read             Consulter une organisation
organisations.block            Bloquer une organisation
organisations.transactions.list
organisations.wallets.read
organisations.kyb.read
```

Le RBAC **par organisation** (`aiglebusiness/membership`, séparateur `:`) est un référentiel
distinct : il n'est pas concerné par cette convention et n'est pas migré.

## Découpage

Ordre de livraison : **L1 → L2 → L3 → L4+L5 → L6 → L7**.

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| L1 ✅ | **Le catalogue.** Format d'une entrée (`slug`, `name`, `description`, `sensitive`), un catalogue par feature, point d'agrégation hors `app/` (contrainte depcruise). Commande `permissions:sync` idempotente remplaçant les seeders de permissions. Aucun changement de comportement. | — | **design approuvé** |
| L2 | **Le filet anti-dérive.** Slug typé depuis le catalogue (le compilateur interdit de vérifier une permission inexistante) + vérification catalogue ↔ base et catalogue ↔ code. Test + commande. À trancher : échec en CI, au démarrage, ou les deux. | L1 | à faire |
| L3 | **Le rôle tout-puissant.** `root` / `super_admin` : un seul nom, ou pas de contournement du tout. Alignement des deux gardes de tentatives qui protègent aujourd'hui deux rôles différents. `make:root-role`, `make:super-admin`. | L2 | à faire |
| L4 | **Normalisation + bascule de la base.** Renommage vers la convention à trois segments, migration de `permissions` et `role_permission` sans perdre les affectations, traitement des 4 fantômes et des slugs créés à la main en prod. **Retrait du CRUD de permissions** — la base cesse de faire autorité ; le CRUD de rôles reste. | L1, L2 | à faire |
| L5 | **Le front.** Fin des énumérations manuelles au profit d'un artefact généré ou vérifié, correction de `isSuper` (`"all"`). **Déployé avec L4.** | L4 | à faire |
| L6 | **Fermeture des zones sans garde.** Gardes sur utilisateurs, appareils, versions d'app, catalogue. Correction du 500 de `getUserTransactionStats` et retrait des 13 `as never`. Choix d'un style d'enforcement unique. | L1, L2 | à faire |
| L7 | **Aide à la composition.** Contrepartie de D4 : modèles de rôles livrés en code, `sensitive` exploité, incompatibilités déclarées (séparation des tâches). Écran de composition groupé par contexte. | L4 | à faire |

**L4 et L5 forment un seul déploiement** : D2 écarte les alias transitoires, donc entre le renommage
côté API et la mise à jour du front, les pages du back-office tomberaient. Si un déploiement
coordonné API+front s'avère impossible, D2 doit être rouverte.

**L2 précède délibérément L4** : poser le filet avant de toucher aux slugs coûte un lot de plus au
début, mais c'est lui qui garantit que la migration ne réintroduit pas d'orphelines.

## Lot L1 — Le catalogue

### Architecture (validée 2026-07-30)

**1. Le helper.** `app/core/team/domain/authorization/permission_catalog.ts`. Le RBAC back-office
est le domaine de `core/team`, où `adminHasPermission` réside déjà. Le fichier n'importe aucune
feature ; les features importent `#core/team/…` (`team` est un supporting, dépendable par tous) et
leurs catalogues vivent dans `presentation/admin/`, hors du `from:` de
`produit-consomme-core-par-service`. Aucune règle depcruise n'est touchée.

**2. Le contrat.**

```ts
declare const brand: unique symbol
export type PermissionSlug = string & { readonly [brand]: 'permission' }

export interface PermissionDefinition {
  readonly slug: PermissionSlug
  readonly name: string          // libellé lu par l'admin qui compose un rôle
  readonly description: string   // ce que la permission ouvre, en une phrase
  readonly sensitive: boolean    // impact argent, accès ou données confidentielles
}

export function definePermissions<K extends string>(
  defs: Record<K, Omit<PermissionDefinition, 'slug'> & { slug: string }>
): Readonly<Record<K, PermissionDefinition>>
```

`definePermissions` contient l'unique `as PermissionSlug` du dépôt : c'est la seule porte par
laquelle une chaîne devient un slug de permission. La marque est un *phantom type* — `brand`
n'existe pas à l'exécution, un `PermissionSlug` reste une `string` ordinaire.

**3. Le verrou.** La marque protège de l'accident, pas de l'intention : `'kyc.read' as unknown as
PermissionSlug` passerait. Ce n'est pas théorique — c'est ce que les 13 `as never` ont fait au
typage de bouncer, et ce qui a laissé passer le 500 de `getUserTransactionStats`. L1 livre donc la
marque **et** son verrou :

```js
// eslint.config.js
{
  files: ['**/*.ts'],
  ignores: ['app/core/team/domain/authorization/permission_catalog.ts'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'TSAsExpression > TSTypeReference > Identifier[name="PermissionSlug"]',
      message: 'Un slug de permission ne se forge pas : déclarez-le via definePermissions().',
    }],
  },
}
```

Le sélecteur attrape aussi le double cast, puisque c'est le `as PermissionSlug` final qui matche.

**4. Les call-sites ne manipulent plus de chaîne.** `adminHasPermission` et le middleware acceptent
la définition, pas son slug :

```ts
adminHasPermission(user, TRANSACTION_PERMISSIONS.list)      // ✅
adminHasPermission(user, 'transactions.list')               // ❌ ne compile pas
middleware.permission([FUNDING_PERMISSIONS.review])         // ✅
```

**5. L'agrégat.** `start/permissions.ts` importe chaque catalogue et appelle
`collectPermissions([...])`, qui aplatit et **échoue au chargement sur slug dupliqué** — deux
features ne peuvent pas revendiquer le même slug.

**6. `permissions:sync`.** Lit l'agrégat, upsert par slug dans la table `permissions`. Remplace la
partie « permissions » des cinq seeders. Elle ne **supprime rien** en L1 (les 4 fantômes et les
slugs créés à la main survivent jusqu'à L4) et n'attache rien à aucun rôle — d'où l'absence de
changement de comportement : insérer les 14 orphelines ne donne de droit à personne.

**7. La table `permissions` cesse de porter la sémantique.** `name` et `description` y sont
recopiés pour l'affichage, `sensitive` n'y descend pas : l'API sert ces métadonnées **depuis le
catalogue**. La table devient un répertoire d'identifiants au service de la clé étrangère
`role_permission` — c'est ce qui rend le CRUD retirable en L4 sans rien perdre.

### Impact sur l'existant (validée 2026-07-31)

**Le catalogue L1 compte 27 permissions** — celles que le serveur vérifie réellement, aux slugs
actuels **inchangés** (la normalisation est L4).

| Feature | Fichier | Nb |
|---|---|---|
| `money/transactions` | modifié | 8 |
| `money/ledger` | modifié | 4 |
| `money/wallet` | modifié | 2 |
| `audit` | modifié | 1 |
| `identity/kyc` | **créé** | 3 |
| `team` | **créé** | 1 |
| `aiglebusiness/funding` | **créé** | 5 |
| `aiglebusiness/organisation` | **créé** | 2 |
| `aiglebusiness/transfer/mass` | **créé** | 1 |

`ledger.read` **disparaît dès L1** : déclaré dans `permissions.config.ts`, vérifié par aucune
policy — du code mort, pas un droit.

**Les seeders changent de nature.** Ils perdent leur bloc de création (repris par
`permissions:sync`) et gardent leur bloc d'attachement aux rôles, mais en **important le
catalogue** au lieu de réécrire le slug :

```ts
// avant — le slug est retapé, rien ne le relie au code qui le vérifie
Permission.updateOrCreateMany('slug', [{ slug: 'organisations.read', … }])

// après — le slug vient du catalogue, une faute de frappe ne compile pas
const slugs = [ORGANISATION_PERMISSIONS.read.slug, ORGANISATION_PERMISSIONS.manage.slug]
```

C'est ce qui **supprime le mécanisme n°4 de la dérive**. Sur les six recensés, L1 en élimine
trois : le n°1 devient le format unique, le n°3 (littéral en dur dans une policy) ne compile plus,
le n°4 passe par le catalogue.

**Fichiers touchés** : `permission_helpers.ts` et `permission_middleware.ts` (signatures),
13 call-sites de policies, 5 fichiers de routes, 5 seeders, `eslint.config.js`.
**Créés** : `permission_catalog.ts`, `start/permissions.ts`, `commands/permissions_sync.ts`.

**Risques de régression**

1. **Seeder lancé sans `permissions:sync` préalable** — `Permission.findBy(slug)` renvoie `null` et
   l'attachement échoue silencieusement. Le seeder doit lever une erreur explicite, jamais continuer.
2. **Baseline `tsc` (74 erreurs)** — le changement de signature fera apparaître des erreurs sur les
   call-sites qui passaient une chaîne. À **corriger**, pas à absorber dans la baseline : c'est le
   signal recherché.
3. **Aucun impact front** — aucun slug ne change, aucune forme de réponse ne change. Le front n'est
   touché qu'en L5.

**Conséquence sur les actions en attente** : `db:seed --files=organisation_permission_seeder` et
`mass_transfer_permission_seeder` deviennent caduques après L1. En attendant, `organisations.*` et
`mass_transfers.read` ne sont pas en base — ces pages admin sont donc inaccessibles à tout rôle
sauf `root`.

### Flux de données (validée 2026-07-31)

Le catalogue circule en trois temps, sur trois horloges différentes.

```
① COMPILATION                    ② DÉPLOIEMENT              ③ REQUÊTE
                                     (manuel)                  (chaque appel)

feature/permissions.config.ts
   definePermissions({…})
          │
          ▼
   start/permissions.ts  ──────▶  ace permissions:sync
   collectPermissions()             upsert par slug
   ⚠ échoue sur doublon                   │
          │                               ▼
          │                       table `permissions`
          │                        (répertoire d'ids)
          │                               │
          │                               ▼
          │                       role_permission ◀── composition d'un rôle
          │                                              par l'admin (inchangé en L1)
          ▼                                                    │
   adminHasPermission(user, DEF) ───────────────────────────┘
        compare DEF.slug aux slugs du rôle chargé
```

**① Compilation.** Le catalogue n'existe qu'en TypeScript. `collectPermissions` échoue au
chargement du module sur slug dupliqué — donc au démarrage et au premier test, pas en production
sous trafic.

**② Déploiement.** `permissions:sync` est lancé **à la main** (contrainte de travail : migrations
lancées par l'utilisateur). Upsert par slug : insertion des absentes, mise à jour de
`name`/`description`, **aucune suppression**. La contrainte unique sur `slug` rend l'opération
idempotente et sûre en concurrence.

> **Ordre d'exploitation obligatoire : `permissions:sync` avant la mise en service du nouveau
> code.** Dans le bon sens, une permission existe en base avant que quiconque la vérifie —
> inoffensif. Dans le mauvais, le code vérifie une permission absente : la garde refuse
> (fail-closed) et tous les rôles sauf `root` perdent l'accès. C'est exactement l'état actuel des
> 14 orphelines.

**③ Requête.** Inchangé en L1 : `adminHasPermission` charge `user.role.permissions` et compare
désormais `DEF.slug` au lieu d'un littéral.

**Ce qui ne change pas en L1** : `GET /team/permissions` et `/all` continuent de servir **la
table**, pas le catalogue. La bascule de la lecture vers le catalogue — et donc l'exposition de
`sensitive` — arrive en **L4**, avec le retrait du CRUD. En L1, `sensitive` est déclaré et
consommé par personne : assumé, il vaut mieux le renseigner quand l'auteur de la permission sait ce
qu'elle ouvre que de l'ajouter après coup sur 27 entrées.

**Deux faits de schéma relevés dans `1739716421055_create_roles_permissions_tables.ts`**

1. **`permissions.slug` est `varchar(50)`.** Le plus long slug de la convention cible —
   `organisations.transactions.export` — fait 33 caractères. La marge tient, mais un quatrième
   segment la ferait sauter. À vérifier en L4 sur la liste définitive, et à élargir si besoin dans
   la même migration.
2. **`role_permission.permission_id` est en `onDelete('CASCADE')`.** Supprimer une ligne de
   `permissions` efface **silencieusement** toutes ses attributions. Sans effet en L1 (qui ne
   supprime rien), mais c'est le risque central de L4 : retirer les 4 fantômes videra les rôles
   `admin`, `kyc_agent` et `support_agent` de leur contenu. À constater avant, pas après.

### Gestion des erreurs (validée 2026-07-31)

| # | Cas | Comportement L1 | Pourquoi |
|---|---|---|---|
| 1 | Deux features déclarent le même slug | `collectPermissions` lève au chargement du module — l'app ne démarre pas, les tests ne passent pas | Un slug partagé signifie que deux features croient contrôler la même porte : erreur de conception, pas cas à gérer en douceur. |
| 2 | Slug malformé | `definePermissions` valide `^[a-z0-9_]+(\.[a-z0-9_]+)+$` et lève sinon | Volontairement **permissif** : les 27 slugs actuels (`wallet_adjustment.execute`…) doivent passer. La règle stricte à trois segments n'arrive qu'en **L4** ; l'imposer en L1 rendrait le catalogue inécrivable. |
| 3 | `permissions:sync` interrompu | Transaction unique, tout ou rien | Un sync partiel laisserait la base dans un état que personne ne peut décrire. L'upsert étant idempotent, relancer suffit. |
| 4 | Slug en base, absent du catalogue | **Rien n'est supprimé**, chacun est listé en sortie | C'est l'inventaire de ce qui a été créé à la main en production, donc **la résolution de I1** : `permissions:sync --dry-run` répond à l'inconnue avant que L4 ait à trancher leur sort. |
| 5 | Admin sans rôle sur une route protégée | **403 explicite**, sur les deux chemins | `team_validator.ts:15` déclare `roleId` optionnel et `admins.role_id` est nullable : le cas est réel. Aujourd'hui `permission_middleware.ts:19` fait `user.role.permissions.map(…)` sans garde → TypeError, donc **500** ; les policies font `user.role?.permissions?.some(…) ?? false` → 403. Deux réponses pour la même situation ; L1 touche déjà les deux signatures, on les aligne. |
| 6 | Seeder de rôles sans permission correspondante | Erreur explicite, arrêt | Silencieusement, `sync([undefined])` produit un rôle vide — qui n'ouvre rien sans que personne le sache. C'est l'état actuel de `admin`, `kyc_agent`, `support_agent`. |
| 7 | Tableau de permissions vide passé à une garde | Refus | `[].some(…)` vaut `false` : le comportement est déjà fail-closed, on le documente plutôt que de le changer. |

**Non traité en L1** : le contournement `root` reste en place tel quel dans les deux gardes — c'est
L3, et L3 seul.

**Principe transverse** : ces erreurs sont soit **au chargement** (1, 2), soit **à la commande**
(3, 4, 6). Aucune n'est différée à la requête. La seule qui reste possible en production est le cas
5, et elle est fail-closed. Délibéré : une erreur de catalogue doit coûter un démarrage raté,
jamais un accès accordé par erreur.

### Tests (validée 2026-07-31)

`tsconfig.json` n'a ni `include` ni `exclude` : `tests/` **est typechecké** par `npm run typecheck`,
donc les assertions de type y sont de vrais tests. Suites `unit` (2 s) et `functional` (30 s).

**A. Assertions de type** — `tests/unit/team/permission_catalog.types.spec.ts`

```ts
// @ts-expect-error un littéral n'est pas un PermissionSlug
adminHasPermission(admin, 'transactions.list')

// @ts-expect-error un objet forgé à la main non plus
adminHasPermission(admin, { slug: 'transactions.list', name: '', description: '', sensitive: false })
```

Aucun coût d'exécution (ils tournent avec `tsc`) et ils se retournent d'eux-mêmes : si la marque
est affaiblie, l'erreur attendue disparaît, `@ts-expect-error` devient inutilisé et `tsc` échoue.

**B. Unitaires du helper** — slug malformé rejeté (`'Transactions.List'`, `'transactions'` sans
point, chaîne vide), slug conforme accepté, `collectPermissions` qui lève sur doublon avec le slug
fautif dans le message, `name`/`description` vides refusés.

**C. Intégrité du catalogue réel** — **le test qui porte le plus de valeur du lot** : il globe
`app/**/permissions.config.ts` et vérifie que chacun est importé par `start/permissions.ts`. Seul
filet contre le défaut connu de l'approche A — une feature qui déclare son catalogue sans que
l'agrégat le reprenne, donc des permissions jamais synchronisées. Vérifie aussi l'unicité des 27
slugs et la présence de `name`/`description`.

**D. Fonctionnels de la commande** — sync sur base vide crée 27 entrées ; rejoué, toujours 27
(idempotence) ; un slug présent en base et absent du catalogue est **listé et survit** ;
`--dry-run` n'écrit rien.

**E. Non-régression des gardes** — admin détenant la permission → 200, ne la détenant pas → 403,
et **admin sans rôle → 403 sur les deux styles d'enforcement**, ce qui verrouille la correction du
500 décrite au cas 5.

**Tests existants à adapter.** `tests/unit/kyc/kyc_policy.spec.ts` construit son admin par `as any`
et passe les slugs en dur ; il doit référencer le catalogue, sinon un renommage en L4 le laissera
vert sur des slugs disparus. Les tests business (`role_management_flow`, `membership_flow`…)
portent sur le RBAC **organisation**, référentiel distinct : non touchés.

> **Ce que ces tests corrigent.** `kyc_policy.spec.ts` est vert aujourd'hui. Il affirme que
> `kyc.read`, `kyc.approve` et `kyc.reject` gouvernent l'accès au KYC — alors qu'aucun des trois
> n'existe en base, donc qu'aucun agent KYC réel ne peut approuver quoi que ce soit. Le test passe
> parce qu'il mocke le rôle. **C'est ce genre de test qui a permis à la dérive de prospérer** : il
> vérifie que la policy lit bien la permission qu'on lui a dit de lire, jamais que cette permission
> existe. La valeur du lot tient donc aux tests **C** et **D**, qui confrontent le catalogue au
> monde réel.

**Baseline** : 483 passés / 5 échecs préexistants (Kyc ×2, ProviderErrorService, DeviceService).
L1 ajoute une vingtaine de tests et ne doit toucher aucun des 5.

### Risques & inconnues (validée 2026-07-31)

| # | Risque | Mitigation | Ce qui reste après mitigation |
|---|---|---|---|
| R-a | **Oubli d'agrégation** — une feature déclare son catalogue, `start/permissions.ts` ne l'importe pas : permissions jamais synchronisées, gardes fail-closed en silence | Test C (glob `app/**/permissions*.ts` ↔ imports de l'agrégat) | Le glob repose sur la **convention de nom** : elle fait donc partie de la règle. |
| R-b | **Échappatoire au typage** — `const s: any = 'x'; adminHasPermission(user, s)` passe la règle ESLint, qui est syntaxique | Revue + règle lint sur `as PermissionSlug` | Réel et non fermable en L1. **C'est la raison d'être de L2** : seule une confrontation catalogue ↔ base ↔ code attrape ce qui échappe au compilateur. |
| R-c | **Confusion avec la baseline `tsc`** — impossible de distinguer une erreur introduite par L1 d'une des 74 préexistantes | Capturer la liste nominative des 74 **avant** de commencer, comparer après | Aucun, si le relevé est le premier geste du lot. |
| R-d | **Call-site « corrigé » par un cast** — faire taire l'erreur au lieu d'importer le catalogue | Règle ESLint + les 13 call-sites revus un par un | Faible, mais c'est exactement ce qui s'est produit avec les 13 `as never` : un précédent, pas une hypothèse. |
| R-e | **Ordre d'exploitation inversé** — code déployé avant `permissions:sync` : 403 en masse sur le back-office | Runbook explicite dans le lot | Subsiste en L1 ; L2 pourra le fermer en faisant échouer le démarrage sur écart. |
| R-f | **Quatre seeders de permissions non versionnés** dans le working tree au 2026-07-31 (`collection_account`, `funding_request`, `funding_settings`, `mass_transfer`) | À commiter avant ou pendant L1 | Le design les prend en compte dans leur état sur disque ; ils disparaissent de toute façon en tant que créateurs de permissions. |

**Plan de repli du lot.** L1 n'a pas d'effet de bord en base au-delà d'insertions de lignes
`permissions` sans attachement, et ne modifie aucun slug. Un retour arrière consiste à révoquer le
commit : les lignes insérées restent, inertes — personne ne les détient. C'est la propriété qui
rend L1 sûr à livrer en premier.

## Inconnues

| # | Inconnue | Résolution |
|---|----------|-----------|
| I1 | Contenu réel de `permissions`, `roles`, `role_permission` et `admins` en production — quels slugs ont été créés à la main, quels rôles sont réellement portés par des comptes, `root` existe-t-il | **Résolue par L1 lui-même** : `permissions:sync --dry-run` produit l'inventaire. Le premier lot livre donc la réponse dont L4 a besoin pour trancher le sort des slugs orphelins, sans extraction manuelle. |
| I2 | L'inférence Adonis propage-t-elle un type non primitif au 3ᵉ argument de `middleware.permission()` ? La déclaration a été vérifiée (`start/kernel.ts:51`), pas le comportement du typeur sur `PermissionDefinition[]` | Spike de dix minutes en ouverture de L1. **Repli** : passer `…review.slug` au lieu de la définition — la garantie de typage reste intacte, seule l'ergonomie du call-site baisse. |

## Hors scope

**Du chantier entier**

- Le **RBAC par organisation** (`aiglebusiness/membership`, séparateur `:`) : référentiel distinct,
  déjà code-first, non migré et non renommé.
- Le **CRUD de rôles** : conservé tel quel. Seul le CRUD de *permissions* est retiré (L4).
- **R6** (consommation cross-feature par repository) : chantier séparé.

**De L1 en particulier** — chacun a son lot

- Normalisation des slugs et migration de la base → **L4**. L1 déclare les slugs **actuels**, tels
  quels, doublons compris.
- Contournement `root` / `super_admin` → **L3**. Les deux gardes restent inchangées en L1.
- Front (énumérations, `isSuper`) → **L5**. Aucun impact front en L1.
- Gardes manquantes sur utilisateurs / appareils / versions / catalogue, correction du 500 de
  `getUserTransactionStats`, retrait des 13 `as never` → **L6**.
- Modèles de rôles, exploitation de `sensitive`, incompatibilités déclarées → **L7**.
- Bascule de `GET /team/permissions` et `/all` vers le catalogue → **L4**. En L1 ces endpoints
  continuent de servir la table.

## Prochaine session

**Design de L1 approuvé** (étapes 0 à 5 terminées pour ce lot). Deux voies possibles :

1. **Implémenter L1** — passer le présent document à `writing-plans` pour produire le plan
   d'implémentation. Premier geste du lot : relever nominément les 74 erreurs `tsc` de la baseline
   (risque R-c), puis le spike de I2 (dix minutes).
2. **Concevoir L2** — reprendre le brainstorming à l'étape 3 sur le filet anti-dérive : approches
   de confrontation catalogue ↔ base ↔ code, et arbitrage échec en CI / au démarrage / les deux.

Les lots L2 à L7 ne sont **pas** encore conçus : seul le découpage et leur intention sont fixés.