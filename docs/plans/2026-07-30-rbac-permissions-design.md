---
status: draft
etape: 3
lot: L1
derniere_maj: 2026-07-30
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
| L1 | **Le catalogue.** Format d'une entrée (`slug`, `name`, `description`, `sensitive`), un catalogue par feature, point d'agrégation hors `app/` (contrainte depcruise). Commande `permissions:sync` idempotente remplaçant les seeders de permissions. Aucun changement de comportement. | — | design en cours |
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

## Inconnues

| # | Inconnue | Résolution |
|---|----------|-----------|
| I1 | Contenu réel de `permissions`, `roles`, `role_permission` et `admins` en production (slugs créés à la main, rôles réellement utilisés, existence de `root`) | À extraire par l'utilisateur avant de figer la migration |

## Hors scope

_(à remplir à l'étape 3)_

## Prochaine session

Étape 3 sur le **lot L1** (le catalogue) : choix de l'approche — catalogue par feature avec slugs
marqués, catalogue central unique, ou registre auto-enregistré au boot. Étapes 0 à 2 terminées et
validées (objectif, convention de nommage, découpage).