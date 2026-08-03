---
status: approved
etape: 5
lot: — (tous livrés)
lots_approuves: L1, L2, L3, L4a, L4b, L5, L6, L7
derniere_maj: 2026-08-01
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

### Inventaire réel de la base (`permissions:sync --dry-run`, 2026-07-31)

L'exécution de la commande livrée en L1 **corrige trois affirmations** des relevés ci-dessus, qui
raisonnaient sur les seeders et non sur la base.

**1. Les 14 « orphelines » existent en base.** `kyc.read`, `kyc.approve`, `kyc.reject`,
`ledgers.read`, `ledgers_report.read`, `user_ledgers.read`, `user_ledgers_report.read`,
`transactions.read`, `transaction.read`, `transactions_report.read`, `transaction_ledger.read`,
`user_transactions.read`, `user_transactions_report.read` sont présentes — créées à la main via le
CRUD. Elles n'étaient orphelines qu'au regard des seeders. Le défaut n'est donc pas qu'elles
manquent, mais qu'aucun environnement neuf ne les aurait : la base de production et le code ne sont
reproductibles ni l'un depuis l'autre.

**2. Sept permissions attendues par les seeders sont absentes de la base** : `audit.read`,
`transaction_refund.execute`, `transactions_refunds.read`, `wallet_adjustment.execute`,
`wallet_adjustment.read`, `team.manage`, `organisations.manage`. `role_permission_seeder` n'a donc
jamais été joué dans son état actuel. Conséquence directe : `team.manage` étant exigé par tout le
module `team`, **seul `root` peut aujourd'hui gérer l'équipe et les rôles**.

**3. Le slug `all` existe en base.** Le contournement du front (`usePermissions.isSuper` teste
`permissions.includes("all")`) est donc **opérationnel**, contrairement à ce qui était écrit plus
haut. Il y a trois mécanismes de tout-pouvoir, pas deux : `root` côté serveur, `all` côté front,
et `super_admin` pour l'exemption de blocage par force brute. **L3 doit traiter les trois.**

**38 permissions en base hors catalogue**, dont des familles entières jamais vérifiées par le
serveur : `tarifications.*` (7), `provider.*` + `providers.read` (8), `service.*` + `services.read`
(7), `user_*` (13), plus `ledger.read`, `user_transaction.read` et `all`. Leurs libellés trahissent
la saisie manuelle (« Tarifications.desactivate ») et portent des fautes de frappe figées —
`tarifications.activitate`, et le slug `service.activate` nommé « Service.activitate ». C'est la
matière de L4, et l'illustration la plus concrète de R1.

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
| D9 | **L'affinage des gardes trop grossières est du ressort de L6**, pas de L1. Une garde existante mais trop large (7 endpoints organisation derrière une seule permission) relève du même travail que l'absence de garde. | (a) Décomposer dès L1 ; (b) un lot dédié après L6. | Décomposer en L1 changerait le comportement — un rôle portant `organisations.read` perdrait l'accès aux membres et au wallet — et priverait L1 de sa propriété d'annulation par simple revert. L6 arrive après L4, donc les nouveaux slugs naissent directement à la convention définitive. | 2026-07-31 |
| D10 | **L2 — filet par commande `permissions:check` + test statique** (approche B). | (a) Tout en test ; (b) refus de démarrer sur écart ; (c) créer une CI ; (d) `permissions:sync` au démarrage. | **Le dépôt n'a aucune CI** — ni GitHub Actions, ni GitLab : `lint`, `typecheck`, `depcruise` et `test` sont lancés à la main. Un refus de démarrer transformerait un écart bénin (38 slugs inertes) en indisponibilité totale ; un sync au boot écrirait en base au démarrage, contre la règle « migrations lancées par l'utilisateur ». | 2026-07-31 |
| D11 | **Deux commandes distinctes**, `permissions:sync` (écrit) et `permissions:check` (constate, code de retour), partageant un service de diff. | (a) Un drapeau `sync --check` ; (b) supprimer `--dry-run` au profit de `check`. | Avec un drapeau, le comportement par défaut écrit : un `--check` oublié dans un script écrit en base. Et les deux commandes ont des codes de sortie opposés sur la même situation — `sync` réussit en résorbant l'écart, `check` échoue dessus. | 2026-07-31 |
| D12 | **La vérification statique est un test, pas une commande.** | Une commande `permissions:check` qui scannerait aussi les sources. | `node ace build` déploie du JavaScript : **les sources TypeScript n'existent pas en production**. Un scan des sources depuis une commande y échouerait ou mentirait. | 2026-07-31 |
| D13 | **L3 — suppression du contournement d'autorisation** : `root` détient explicitement les 27 permissions, le `if (slug === 'root')` disparaît des deux gardes. L'exemption de blocage ne vise plus un nom de rôle mais **le dernier compte actif**. | (a) Aligner les trois mécanismes sur `root` en gardant le contournement ; (b) supprimer le contournement mais garder une exemption nominative. | Un contournement en dur rend l'audit aveugle (on ne sait pas quel droit a été exercé), empêche de retirer un droit à un compte compromis, et **masque la dérive** — c'est vraisemblablement pourquoi 7 gardes inopérantes n'ont jamais été remarquées. L'inventaire montre 2 comptes et 1 rôle : le coût de transition est nul aujourd'hui, il croîtra avec chaque rôle réel. | 2026-07-31 |
| D14 | **`make:root-role` attache le catalogue, plus la table.** | Attacher toutes les permissions persistées, comme aujourd'hui. | Sinon `root` porte aussi les 38 slugs hors catalogue, dont `all` — la permission magique du front. C'est ce changement qui fait converger front et serveur. | 2026-07-31 |
| D15 | **Aucune vérification automatique de la complétude du rôle** : `make:root-role` est ajouté au runbook de déploiement. | (a) `permissions:check` vérifie aussi le rôle ; (b) une commande `roles:check`. | Choix de simplicité. **Revers assumé** : un `make:root-role` oublié après l'ajout d'une permission ferme silencieusement une porte à `root` — la faiblesse même qu'on reproche aux seeders. | 2026-07-31 |
| D16 | **`root` reste une donnée d'amorçage**, créée et tenue à jour par commande. | En faire un modèle de rôle déclaré en code, par anticipation de L7. | L'administrateur compose les rôles ; le code déclare les permissions. Anticiper L7 empiéterait sur un lot non conçu. | 2026-07-31 |
| D17 | **L3 se déploie en deux temps** : d'abord `make:root-role` corrigée et son exécution, ensuite le retrait du contournement. | Un déploiement unique. | En un seul temps, il existe une fenêtre où `root` a perdu le contournement sans avoir reçu ses 7 permissions manquantes. Sur les deux seuls comptes d'administration de la plateforme, cette fenêtre ne vaut pas le déploiement économisé. | 2026-07-31 |
| D18 | **Une constante de catalogue par ressource**, et non par feature : `SERVICE_TYPE_PERMISSIONS`, `PRICING_PERMISSIONS`, `REFUND_PERMISSIONS`… avec des clés courtes (`list`, `read`, `create`, `update`, `delete`). Un fichier `permissions.config.ts` par feature peut donc porter plusieurs catalogues. | Une constante par feature, regroupant toutes ses ressources. | `CATALOG_PERMISSIONS.pricingUpdate` empilait deux niveaux de nommage là où `PRICING_PERMISSIONS.update` se lit d'un coup. Le regroupement par feature mélangeait jusqu'à cinq ressources dans une même constante. | 2026-08-01 |
| D19 | **Pas de mécanisme d'incompatibilité entre permissions.** L'avertissement de séparation des tâches vit dans la **description** de la permission concernée. | (a) Refus à l'écriture ; (b) avertissement renvoyé par l'API ; (c) refus avec dérogation tracée. | La description est précisément ce que lit l'administrateur au moment de composer un rôle — c'est là que l'avertissement a le plus de chances d'être vu. Un mécanisme dédié ajouterait une surface pour un gain incertain. | 2026-08-01 |
| D20 | **Pas de modèles de rôles livrés en code pour l'instant.** | Modèles copiables ; ou rôles entièrement gérés par le code. | Aucun rôle métier n'existe encore en production : concevoir des modèles avant d'avoir vu quels rôles émergent reviendrait à deviner. | 2026-08-01 |
| D21 | **`team.manage` est décomposé** en `admins.manage` et `roles.manage`. | Le renommer en `admins.manage` seul ; ou le laisser tel quel. | Gérer des comptes d'administration et composer des rôles sont deux pouvoirs distincts — le second permet de s'attribuer n'importe quel droit du catalogue. Écart assumé au cadrage « renommage à périmètre constant ». | 2026-08-01 |
| D22 | **Nommage des ressources non dénombrables** : `audit.read` → `audit_logs.list`, `kyc.*` → `kyc_documents.*`. | Exceptions assumées à la règle du pluriel ; ou `verifications.*` pour le KYC. | Pluraliser la ressource réelle — les entrées du journal, les documents — évite l'exception. `kyc_documents` conserve le sigle que tout le monde emploie. | 2026-08-01 |
| D23 | **Les énumérations du front restent maintenues à la main.** | Générer un fichier depuis l'API ; ou vérifier par un test. | Sans CI, une commande de génération ne serait pas plus contraignante qu'une convention — rien ne forcerait à la relancer — et coupleraient deux dépôts par un chemin en dur. L'écran de composition consomme déjà le catalogue via l'API ; ne restent en dur que les slugs qu'exigent `definePageMeta` et `<Can>`, évalués avant tout appel réseau. | 2026-08-01 |
| D24 | **Pas de composable qui encapsule des permissions.** `useTransactionPermissions` est supprimé ; les composants appellent `can(XPermissions.Y)` là où la garde s'applique. | Le conserver pour les règles composites. | Même raisonnement qu'en L6a : les policies bouncer cachaient la permission dans le contrôleur, le middleware la rend visible sur la route. Un composable rejoue ce masquage côté front — et l'a prouvé : `canReadTransactionLedger` a dissimulé le slug inexistant `transaction.ledger` pendant des mois, là où `TransactionPermissions.TRANSACTION_LEDGER_READ` aurait échoué à la compilation. | 2026-08-01 |

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
| L1 ✅ | **Le catalogue.** Format d'une entrée (`slug`, `name`, `description`, `sensitive`), un catalogue par feature, point d'agrégation hors `app/` (contrainte depcruise). Commande `permissions:sync` idempotente remplaçant les seeders de permissions. Aucun changement de comportement. | — | **implémenté** |
| L2 ✅ | **Le filet anti-dérive.** Slug typé et verrou ESLint (livrés en L1) ; `permissions:check` pour l'écart catalogue ↔ base, test statique pour l'écart catalogue ↔ code. | L1 | **implémenté** |
| L3 ✅ | **Le rôle tout-puissant.** Contournement d'autorisation supprimé ; exemption de blocage fondée sur le dernier compte actif ; `make:root-role` attache le catalogue. | L2 | **implémenté** |
| L4a ✅ | **Retrait du CRUD + bascule de la lecture vers le catalogue.** Livré. `permissions:prune` livrée, non exécutée. | L1, L2 | **implémenté** |
| L4b ✅ | **Normalisation des slugs.** Renommage vers la convention à trois segments, migration de `permissions` et `role_permission` sans perdre les affectations, traitement des 4 fantômes et des slugs créés à la main en prod. **Retrait du CRUD de permissions** — la base cesse de faire autorité ; le CRUD de rôles reste. | L1, L2 | à faire |
| L5 ✅ | **Le front.** Fin des énumérations manuelles au profit d'un artefact généré ou vérifié, correction de `isSuper` (`"all"`). **Déployé avec L4.** | L4 | à faire |
| L6 ✅ | **Fermeture des zones sans garde et affinage des gardes trop grossières.** Gardes sur utilisateurs, appareils, versions d'app, catalogue ; décomposition des permissions organisation (cf. « Matière pour L6 »). Correction du 500 de `getUserTransactionStats` et retrait des 13 `as never`. Choix d'un style d'enforcement unique. | L1, L2 | à faire |
| L7 ✅ | **Composition des rôles.** Contrepartie de D4 : modèles de rôles livrés en code, `sensitive` exploité, incompatibilités déclarées (séparation des tâches). Écran de composition groupé par contexte. | L4 | à faire |

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

### État de livraison (2026-07-31)

**Implémenté.** Catalogue (`app/core/team/domain/value_objects/permission_catalog.ts` — le design
disait `domain/authorization/`, corrigé pour respecter la règle 4 de `type-placement-rules`, qui
n'autorise sous `domain/` que les six sous-dossiers canoniques), 2 exceptions, 9 catalogues de
features (27 permissions), `start/permissions.ts` préchargé, `commands/permissions_sync.ts`,
gardes typées, règle ESLint, seeders allégés, 4 seeders de permissions supprimés.

**Tests** — les cinq groupes prévus : A (types), B (unitaires), C (intégrité), D (`permissions:sync`),
E (gardes HTTP). 31 tests ajoutés.

Deux d'entre eux ont été vérifiés par sonde, pour ne pas se contenter d'un vert :

- **C** — un catalogue temporaire non référencé par l'agrégat fait bien échouer le test.
- **E** — en restaurant le `user.role.permissions` sans garde, le test « administrateur sans rôle »
  échoue avec `expected 500 to equal 403`. Le défaut décrit au cas 5 était donc réel, et il est
  désormais verrouillé.

**Vérifications** : `tsc` 74 erreurs (baseline exacte, aucune nouvelle) — `depcruise` 0 erreur —
`eslint` 0 erreur — tests **514 passés / 5 échecs** contre 483/5 en baseline, les 5 étant les
préexistants (Kyc ×2, ProviderErrorService, DeviceService).

**Non commité** : le working tree contient un travail en cours indépendant ; le découpage des
commits est laissé à l'utilisateur. Quatre fichiers de routes non versionnés
(`funding_request_routes`, `admin_organisation_routes`, `admin_mass_transfer_routes`) et
`funding_settings_seeder` portent des modifications L1 mêlées à ce travail.

## Lot L2 — Le filet anti-dérive

### Architecture (validée 2026-07-31)

L1 a déjà livré la moitié du filet : le slug typé et le verrou ESLint empêchent de **vérifier une
permission non déclarée**. L2 traite l'inverse et l'état de la base.

| Écart | Nature | Gravité | Traité par |
|---|---|---|---|
| Permission du catalogue **absente de la base** | opérationnelle | **grave** — la garde refuse tout le monde sauf `root`, état actuel de `team.manage` | `permissions:check`, code 1 |
| Permission en base **hors catalogue** | opérationnelle | bénigne — 38 cas, inertes tant qu'aucun rôle ne les porte | `permissions:check`, avertissement |
| Permission déclarée **jamais vérifiée** | statique | moyenne — la fabrique à fantômes | test statique |
| Permission vérifiée par une policy **jamais atteignable** | statique | cas `viewUserTansactionsReport` | **L6** |

**Service de diff partagé** — `app/core/team/application/services/permission_catalog_diff_service.ts` :

```ts
interface PermissionCatalogDiff {
  missing: PermissionDefinition[]   // au catalogue, absentes de la base
  outdated: PermissionDefinition[]  // libellé ou description divergent
  unknown: Permission[]             // en base, hors catalogue
}
```

Le catalogue lui est passé **en paramètre**, jamais importé : `ADMIN_PERMISSION_CATALOG` vit dans
`start/`, et un import `app/ → start/` inverserait le sens de l'assemblage.

**Test statique** — pour chaque `permissions*.config.ts`, extraire le nom exporté et les clés, puis
chercher `NOM_CATALOGUE.clé` ailleurs dans `app/`. Chercher le slug littéral serait vain : sa
disparition des call-sites est précisément ce que L1 a obtenu.

### Gestion des erreurs et tests (validée 2026-07-31)

| Situation | Sortie de `permissions:check` |
|---|---|
| `missing` non vide | **1** |
| `outdated` non vide | 0, avec affichage — un libellé n'ouvre ni ne ferme aucune porte |
| `unknown` non vide | 0 et avertissement ; **1** avec `--strict` |
| Base injoignable | 1, message explicite — ne pas laisser croire à une vérification réussie |

**Tests** : service de diff (unitaires sous transaction), `permissions:check` (codes de sortie),
test statique vérifié par sonde — une permission ajoutée au catalogue sans call-site doit le faire
échouer.

**Angle mort assumé** : `const { read } = FUNDING_PERMISSIONS` échapperait au scan par symbole.
C'est un **faux négatif** — le test échouerait à tort plutôt que de laisser passer une fantôme. Le
comportement est du bon côté.

### État de livraison L2 (2026-07-31)

**Implémenté** : `permission_catalog_diff_service.ts` (service partagé), `commands/permissions_check.ts`,
`permissions_sync` refactoré sur le service, test statique `tests/unit/team/permission_usage.spec.ts`,
tests du diff et des codes de sortie.

**Vérifié par sonde** : une permission ajoutée au catalogue sans call-site fait échouer le test
statique en la nommant — `audit.purge (AUDIT_PERMISSIONS.auditPurge)`.

**Vérifié en réel** : `node ace permissions:check` sort en **code 1** sur la base de développement et
nomme les 7 gardes inopérantes (`audit.read`, `wallet_adjustment.*`, `transaction_refund.execute`,
`transactions_refunds.read`, `team.manage`, `organisations.manage`).

**Vérifications** : `tsc` 74 (baseline exacte) — `depcruise` 0 erreur — `eslint` 0 erreur — tests
**525 passés / 5 échecs** contre 483/5 en baseline, soit **+42 tests** depuis le début du chantier.

**À ajouter au runbook de déploiement** : `permissions:sync` puis `permissions:check` avant la mise
en service. Sans CI, c'est la seule chaîne qui empêche une garde de partir inopérante en production.

## Lot L3 — Le rôle tout-puissant

### Inventaire de production (`roles:inventory`, 2026-07-31)

```
root              51 permission(s)   2 compte(s)  ⚠ porte « all »
Comptes sans rôle : 0    Comptes actifs : 2    Total comptes : 2
```

**Un seul rôle existe.** `super_admin`, `admin`, `kyc_agent`, `finance_admin` et `support_agent`
n'ont jamais été créés : le seeder n'a jamais été joué. Les deux seuls comptes d'administration
portent `root`, qui détient 51 permissions dont **20 seulement** des 27 du catalogue.

Conséquences : la question « `root` ou `super_admin` » est tranchée par les faits ; **D10 est
caduque** (elle attache le catalogue à un rôle inexistant) ; et le risque de migration de L4 est
quasi nul — il n'y a aucun rôle métier à préserver.

### Les quatre problèmes

**1. Le contournement court-circuite le RBAC.** `if (user.role?.slug === 'root') return true` rend
l'audit aveugle (impossible de savoir quel droit a été exercé), empêche de retirer un droit à un
compte compromis, rend les tests trompeurs (`kyc_policy.spec.ts` est vert alors qu'aucun agent KYC
réel ne pourrait approuver), et **masque la dérive**.

**2. Trois noms pour la même idée.** `permission_helpers` et `permission_middleware` visent `root` ;
`admin_otp_attempt_guard` définit `SUPER_ADMIN_SLUG = 'root'` ; `admin_attempt_guard` définit la
constante du **même nom** à `'super_admin'` — un rôle inexistant. Même commentaire dans les deux
fichiers : c'est un copier-coller mal terminé, pas une intention.

**3. Le back-office est verrouillable par un tiers.** `autoBlockAdmin` pose `isActive = false` et
révoque les jetons après **9 échecs de mot de passe sur une adresse e-mail**, sans aucune
authentification réussie. L'exemption visant un rôle inexistant, les deux comptes de production sont
concernés : **18 requêtes suffisent à fermer le back-office**, et seule une intervention en base
permet de le rouvrir.

**4. Le front a son propre mécanisme.** `isSuper` teste le slug `all`, porté par `root` et déclaré
dans aucun code. Attacher `all` à un rôle métier lui ouvrirait toutes les pages pendant que le
serveur refuserait chaque appel.

### Architecture (validée 2026-07-31)

1. Retrait du `if (slug === 'root')` dans `permission_helpers.ts` et `permission_middleware.ts`.
2. `make:root-role` attache le **catalogue** (27) et non plus la table (51) — `root` cesse de porter
   `all`.
3. `AdminRepository` expose `countActive()`. Au seuil de blocage permanent : plus d'un compte actif
   → désactivation ; un seul → blocage temporaire 24 h et alerte CRITICAL, jamais `isActive = false`.
   Les deux gardes partagent enfin le même comportement.
4. Le front n'est pas touché (L5) ; les 38 slugs orphelins non plus (L4).

### Ordre de déploiement

| | Contenu | État après |
|---|---|---|
| **1** | `make:root-role` corrigée + `permissions:sync` + exécution des deux | `root` porte les 27 du catalogue, ne porte plus `all`. Contournement **toujours actif** : aucun risque. |
| **2** | Retrait du contournement + exemption non nominative | `root` passe par le RBAC réel, qu'il détient déjà intégralement. Aucune fenêtre de dégradation. |

### Risques

| # | Risque | Traitement |
|---|---|---|
| R-g | `make:root-role` oublié après ajout d'une permission → `root` perd une porte | **Assumé** (D15). Porté par le runbook, sans vérification automatique. |
| R-h | DoS partiel : un attaquant peut désactiver tous les comptes **sauf un** | Nommé, non traité. Le verrouillage *total* devient impossible, ce qui était l'objectif. Le blocage permanent sur simple connaissance d'un e-mail mériterait son propre réexamen. |
| R-i | Les deux comptes portent le même rôle : aucune séparation des tâches réelle | Hors L3 — c'est L7 qui donnera de quoi composer autre chose. |

### État de livraison L3 (2026-08-01)

**Implémenté** : contournement retiré de `permission_helpers.ts` et `permission_middleware.ts` ;
`AdminRepository.countActive()` (port + impl) ; exemption « dernier compte actif » dans les deux
gardes de tentatives, avec des événements d'audit renommés (`ADMIN_LAST_ACTIVE_LOCK_ATTEMPT`,
`LAST_ACTIVE_ADMIN_NOT_AUTO_BLOCKED`) ; `make:root-role` attache le catalogue et **refuse d'écrire**
si une permission du catalogue manque en base.

**Commande ajoutée hors design** : `roles:inventory`, écrite pour instruire I3. Conservée — savoir
quels rôles existent, ce qu'ils portent et qui les porte est un besoin d'audit permanent. À retirer
si jugée superflue.

**Tests inversés** — les deux qui documentaient le contournement :
`tests/unit/kyc/kyc_policy.spec.ts` (« root a toutes les permissions KYC » devient « root sans
permission ne passe pas », doublé d'un cas où il les porte) et le cas root de
`permission_guard.spec.ts`.

**Tests ajoutés** : `admin_attempt_guard_exemption.spec.ts` — dernier compte actif jamais
désactivé sur les deux gardes, compte parmi plusieurs désactivé sur les deux gardes, et le rôle
`root` ne dispense plus du blocage définitif.

**Vérifié en réel** : `node ace make:root-role` sur la base de production **refuse d'écrire**
(code 1) en nommant les 7 permissions absentes ; l'inventaire confirme que le rôle est resté
intact. Le garde-fou empêche bien de laisser `root` incomplet.

**Vérifications** : `tsc` 74 (baseline exacte) — `depcruise` 0 erreur — `eslint` 0 erreur — tests
**531 passés / 5 échecs** contre 483/5 en baseline, soit **+48 tests** depuis le début du chantier.

**Rangement** : les quatre commandes RBAC sont regroupées dans `commands/rbac/`
(`permissions_sync`, `permissions_check`, `make_root_role`, `roles_inventory`). Le scan des
commandes est récursif — vérifié par `node ace list`. `create_super_admin` reste à la racine : il
crée un compte, pas un rôle.

**Étape 1 du déploiement exécutée** (par l'utilisateur, 2026-08-01). État de la base vérifié :
`root` porte exactement les **27 permissions du catalogue**, ne porte plus `all`, et
`permissions:check` sort en succès. Le retrait du contournement (étape 2) peut donc être déployé
sans fenêtre de dégradation. Les 38 slugs hors catalogue subsistent — ils relèvent de L4.

**Relevé au passage — [[R11]]** : les tests s'exécutent sur la base de **production**
(`config/database.ts` n'a qu'une connexion, pas de `.env.test`), et plusieurs suites vident des
tables en comptant sur le rollback. Le rollback fonctionne — les 38 slugs hors catalogue ont
survécu à toutes les exécutions — mais la marge est mince. Inscrit au backlog comme chantier à
part.

## Lot L6 — Fermeture des zones sans garde

### Découpage

| Sous-lot | Contenu | Routes | Slugs |
|---|---|---|---|
| **L6a** ✅ | Style d'enforcement unique, migration des policies, test global des gardes | 18 migrées | 0 |
| **L6b** ✅ | Utilisateurs, appareils, paliers de vérification, activation de portefeuille | 20 | 15 |
| **L6c** ✅ | Catalogue des services — impact financier direct (tarifications) | 24 | 24 |
| **L6d** ✅ | Versions de l'application | 5 | 5 |
| **L6e** ✅ | Affinage des organisations | 7 | 4 |

### Architecture — middleware partout (validée 2026-08-01)

Deux styles coexistaient : middleware de route et policy bouncer. Aucune décision d'accès du
back-office ne dépend de la ressource — c'est du RBAC pur — donc le middleware suffit. L'argument
décisif : **la garde devient visible dans le fichier de routes**, ce qui rend possible un test que
les policies interdisaient — parcourir le routeur et vérifier que chaque route porte une
permission.

Deux cas ne se convertissent pas et passent par `adminHasPermission` :

- `kyc_controller.process` — la permission dépend du **payload** (`approved` → `kyc.approve`,
  `rejected` → `kyc.reject`). Le middleware garde la route avec les deux, le contrôleur vérifie
  celle qu'exige le sens de la décision.
- `transactions_controller.findTransaction` — le volet « écritures » est **conditionnel** : son
  absence n'est pas un refus mais une projection plus pauvre.

### État de livraison L6a (2026-08-01)

**18 routes migrées** vers le middleware : audit (2), grand livre (2), transactions (5), portefeuille
(2), vérification (4), plus 5 routes hébergées sous `/users` qui appartiennent à d'autres features.

**Les 5 policies bouncer sont supprimées**, ainsi que les **13 `as never`**. Conséquence mesurée :
**11 erreurs de la baseline `tsc` disparaîssent** (74 → 63) — c'étaient de vraies erreurs que les
casts masquaient. Le **500 de `getUserTransactionStats` est corrigé mécaniquement** : il n'existait
que parce que bouncer résolvait l'action par une chaîne.

`start/transmit.ts` autorisait le flux SSE via `new KycPolicy().viewAny(user)` ; il passe par
`adminHasPermission`.

**Test global** — `tests/unit/team/admin_routes_permission.spec.ts` parcourt le routeur : **108
routes admin, 55 gardées, 53 sans permission** dont 4 d'authentification légitimes. Les 49 restantes
sont inscrites dans une **liste d'exemptions** que chaque sous-lot doit réduire. Le test échoue dans
les deux sens : sur une route non gardée hors liste, **et** sur une exemption devenue inutile — la
liste ne peut donc pas survivre à ce qu'elle décrit. Vérifié à l'écriture : il a immédiatement
détecté deux routes que j'avais omises (`PUT /users/:id/block` et `/activate`).

**Test supprimé** : `tests/unit/kyc/kyc_policy.spec.ts` — son objet n'existe plus. La couverture
équivalente est assurée par `permission_guard.spec.ts` et le test global.

**Zones non gardées découvertes en chemin** : `/kyc/levels` (4 routes — les paliers pilotent les
limites de transaction) et `/wallets/:userId/activate|deactivate` (2 routes — geler le portefeuille
d'un client). Six de plus que le décompte initial.

**Vérifications** : `tsc` **63** (11 de moins que la baseline, aucune nouvelle) — `depcruise` 0
erreur, 52 warnings (un de moins) — `eslint` 0 erreur — tests **538 passés / 5 échecs**.

### État de livraison L6b (2026-08-01)

**20 routes gardées, 13 permissions** — dont 9 reprises des slugs déjà en base et **4 créées** :
`users_report.read`, `user.activate`, `kyc_levels.read`, `kyc_levels.manage`.

| Route | Permission |
|---|---|
| `GET /users`, `/users/search` | `users.read` |
| `GET /users/stats` | `users_report.read` |
| `GET /users/:id` | `user.read` |
| `GET /users/:id/wallet-stats` | `user_wallet.read` |
| `PUT /users/:id/block` | `user.block` |
| `PUT /users/:id/activate` | `user.activate` |
| `PUT /wallets/:userId/deactivate` | `user_wallet.block` |
| `PUT /wallets/:userId/activate` | `user_wallet.activate` |
| `GET /devices`, `/devices/users/:userId` | `user_devices.read` |
| `GET /devices/:deviceId` + 3 sous-routes | `user_device.read` |
| `DELETE /devices/users/:userId/:deviceId/revoke` | `user_device.revoke` |
| `GET /kyc/levels` | `kyc_levels.read` |
| `POST`, `PUT`, `DELETE /kyc/levels` | `kyc_levels.manage` |

Deux catalogues créés (`identity/user`, `identity/device`), deux étendus (`money/wallet`,
`identity/kyc`). Le catalogue passe de **27 à 40 permissions**.

**Six slugs de la base restent non déclarables** faute de route correspondante. Le front les
déclare, la base les porte, l'API n'expose rien de tel — le test statique les refuserait, à juste
titre. Ils sont laissés en place pour l'instant : inertes, puisqu'aucun rôle ne les porte depuis la
resynchronisation de `root` et qu'aucun endpoint ne les vérifie.

| Slug | Sort |
|---|---|
| `user_transaction.read` | **À supprimer** — doublon de `transaction.read` : le détail d'une transaction est le même droit, qu'on y arrive par le registre ou par la fiche d'un utilisateur |
| `user_wallet.unblock` | **À supprimer** — doublon de `user_wallet.activate`, adossé à `PUT /wallets/:userId/activate` |
| `user_wallet.adjust` | **À supprimer** — doublon de `wallet_adjustment.execute`, au catalogue depuis L1 |
| `user_password.reset` | Indéterminé — correspondrait à une réinitialisation par un administrateur, non exposée aujourd'hui |
| `users_support.read` | Indéterminé |
| `user_device.set_primary` | Indéterminé — aucune route admin ne désigne l'appareil principal |

Les trois premiers sont condamnés (décidé le 2026-08-01) : le nettoyage post-L6 n'aura pas à
retrancher leur cas.

**La whitelist du test global fond** : `EXEMPTED_PATTERNS` est **vide**, et il ne reste que trois
préfixes — l'authentification (permanent), le catalogue des services et les versions d'application.
Le plancher de routes gardées passe de 55 à **75**.

**Vérifications** : `tsc` **63** (aucune nouvelle) — `depcruise` 0 erreur — `eslint` 0 erreur —
tests **538 passés / 5 échecs**.

> **Ordre de déploiement obligatoire.** Le contournement `root` n'existe plus : les 20 routes
> nouvellement gardées refuseront **tout le monde**, `root` compris, tant que les 4 nouvelles
> permissions ne sont pas en base et attachées. Avant de déployer :
>
> ```
> node ace permissions:sync
> node ace make:root-role
> node ace permissions:check
> ```
>
> C'est le risque R-g qui se matérialise pour la première fois — assumé par D15, porté par le
> runbook et par aucune vérification automatique.

### État de livraison L6c (2026-08-01)

**24 routes gardées, 24 permissions** — une par opération, application directe de D4. **17 slugs
repris** de la base, **7 créés** (méthodes de paiement et coordonnées de la société, qui n'avaient
aucun slug).

| Ressource | Routes | Slugs |
|---|---|---|
| `service-types` | 5 | `services.read`, `service.read/create/update/delete` |
| `payment-methods` | 5 | **créés** : `payment_methods.read`, `payment_method.read/create/update/delete` |
| `providers` | 7 | `providers.read`, `provider.read/create/update/activate/deactivate/delete` |
| `service-provider-methods` | 5 | `tarifications.read/create/update/delete`, `tarification.read` |
| `company-contacts` | 2 | **créés** : `company_contacts.read`, `company_contact.update` |

**Quatre slugs de la base n'ont aucune route** et rejoignent les orphelins : `service.activate` et
`service.deactivate` — seuls les providers exposent ces gestes — ainsi que
`tarifications.activitate` et `tarifications.desactivate`, dont les noms portent des fautes de
frappe figées en base.

**À noter pour L4b** : `tarification(s).*` est le seul groupe de slugs en français du catalogue,
là où le front dit `pricings.read`. Le renommage devra trancher.

Le catalogue passe de 40 à **64 permissions**. La whitelist du test global ne contient plus que
l'authentification et les versions d'application ; le plancher de routes gardées passe à **99**.

**Vérifications** : `tsc` **63** (aucune nouvelle) — `eslint` 0 erreur — tests **538 passés /
5 échecs**.

> **Avant déploiement** : 7 permissions manquent en base. Sans `permissions:sync` puis
> `make:root-role`, les 24 routes du catalogue refuseront tout le monde — contournement `root`
> compris, supprimé en L3.

### État de livraison L6d (2026-08-01)

**5 routes gardées, 5 permissions créées** — la zone n'avait aucun slug en base ; le front n'en
déclarait qu'un seul, `app_versions.read`.

| Route | Permission |
|---|---|
| `GET /app-versions` | `app_versions.read` |
| `GET /app-versions/:id` | `app_version.read` |
| `POST /app-versions` | `app_version.create` |
| `PUT /app-versions/:id` | `app_version.update` |
| `DELETE /app-versions/:id` | `app_version.delete` |

Les permissions rejoignent le catalogue de `identity/device` : c'est la feature qui porte ces
routes. Publier ou modifier une version engage `minVersion`, `criticalUpdate` et le lien de
téléchargement consultés par toute la flotte installée — les descriptions le disent.

**La whitelist du test global ne contient plus que l'authentification.** Toutes les zones
temporaires ont été payées : appareils, utilisateurs, portefeuilles, paliers de vérification,
catalogue des services, versions d'application. Plancher de routes gardées : **104** sur 108, les
4 restantes étant `login`, `refresh`, `setup-password` et `verify-otp`.

Le catalogue passe de 64 à **69 permissions**.

**Vérifications** : `tsc` **62** (une de moins, aucune nouvelle) — `eslint` 0 erreur — tests
**538 passés / 5 échecs**.

> **Avant déploiement** : **12 permissions** manquent désormais en base (7 de L6c + 5 de L6d).
> `permissions:sync` puis `make:root-role` sont obligatoires, sans quoi 29 routes refuseront tout le
> monde.

### Découpage des catalogues par ressource (2026-08-01)

Les catalogues étaient groupés par feature ; ils le sont désormais **par ressource**. Un fichier
`permissions.config.ts` peut porter plusieurs constantes.

| Avant | Après |
|---|---|
| `CATALOG_PERMISSIONS` (5 ressources) | `SERVICE_TYPE_`, `PAYMENT_METHOD_`, `PROVIDER_`, `PRICING_`, `COMPANY_CONTACT_` |
| `TRANSACTION_PERMISSIONS` (3) | `TRANSACTION_`, `USER_TRANSACTION_`, `REFUND_` |
| `FUNDING_PERMISSIONS` (3) | `FUNDING_REQUEST_`, `FUNDING_SETTINGS_`, `COLLECTION_ACCOUNT_` |
| `KYC_PERMISSIONS` (2) | `KYC_`, `KYC_LEVEL_` |
| `WALLET_PERMISSIONS` (2) | `USER_WALLET_`, `WALLET_ADJUSTMENT_` |
| `LEDGER_PERMISSIONS` (2) | `LEDGER_`, `USER_LEDGER_` |
| `DEVICE_PERMISSIONS` (2) | `DEVICE_`, `APP_VERSION_` |

**25 catalogues** pour 69 permissions. Les clés sont courtes et uniformes — `PRICING_PERMISSIONS.update`
au lieu de `CATALOG_PERMISSIONS.pricingUpdate`.

**Trou fermé au passage** : le test d'intégrité vérifiait que chaque **fichier** de catalogue est
importé par l'agrégat, pas que chaque **export** y figure. Avec plusieurs constantes par fichier, en
oublier une aurait été invisible — ses permissions n'auraient jamais été synchronisées et ses gardes
auraient refusé tout le monde. Il inspecte désormais les exports : il importe chaque fichier, repère
les valeurs qui sont des catalogues, et exige que chaque nom apparaisse dans `start/permissions.ts`.
Strictement plus fort — un fichier non importé n'a aucun export dans l'agrégat.

### État de livraison L6e (2026-08-01)

**7 routes, 6 permissions** — la zone était gardée, mais par une seule permission de groupe.
Désormais chaque endpoint porte la sienne, et la garde de groupe est retirée : elle aurait exigé
`organisation.read` en plus de chaque droit propre, y compris pour parcourir la liste.

| Route | Permission | Origine |
|---|---|---|
| `GET /organisations`, `/search` | `organisations.read` | existant |
| `GET /organisations/:id` | `organisation.read` | **créé** |
| `GET /organisations/:id/members` | `organisation_members.read` | **créé** |
| `GET /organisations/:id/roles` | `organisation_roles.read` | **créé** |
| `GET /organisations/:id/wallet-stats` | `organisation_wallet.read` | **créé** |
| `PATCH /organisations/:id/payable` | `organisations.manage` | existant |

Consulter le solde d'un marchand et lister l'identité de ses membres ne relèvent plus du même droit
que voir la liste des organisations. Trois des quatre slugs créés reprennent **les noms déjà
déclarés par le front**, qui n'existaient nulle part ailleurs : L5 n'aura qu'à les brancher.

Quatre constantes selon D18 : `ORGANISATION_`, `ORGANISATION_MEMBER_`, `ORGANISATION_ROLE_`,
`ORGANISATION_WALLET_`.

**Restent non déclarables** : `organisation.block` (lot O3 non livré),
`organisation_transactions.read` et `organisation_kyb.read` — les onglets correspondants consomment
les endpoints globaux filtrés, sans route admin dédiée.

**Vérifications** : `tsc` **62** (aucune nouvelle) — `eslint` 0 erreur — tests **538 passés /
5 échecs**.

### L6 est terminé

| Sous-lot | Routes gardées | Permissions |
|---|---|---|
| L6a | 18 migrées | 0 |
| L6b | 20 | 13 |
| L6c | 24 | 24 |
| L6d | 5 | 5 |
| L6e | 7 affinées | 4 |

**Le catalogue compte 73 permissions**, contre 27 à la fin de L1. **104 routes admin sur 108 sont
gardées**, les 4 restantes étant les points d'entrée de l'authentification. La whitelist du test
global ne contient plus qu'eux.

## Lot L4a — Retrait du CRUD et bascule de la lecture

### État de livraison (2026-08-01)

**Le CRUD de permissions n'existe plus.** C'est la réponse directe à R1.

| Supprimé | Conservé |
|---|---|
| `create_`, `update_`, `delete_permission_use_case` | `list_catalog_permissions_use_case` (nouveau) |
| `list_permissions_use_case`, `list_all_permissions_use_case`, `get_permission_use_case` | — |
| Routes `POST`, `PUT`, `DELETE` sur `/team/permissions` | Routes `GET` |
| `permission_validator.ts`, `PermissionSlugAlreadyExistsException` | Tout le CRUD de **rôles**, inchangé |
| Méthodes `store`, `update`, `destroy` du contrôleur | `index`, `all`, `show` |

**La lecture sert le catalogue**, augmenté de l'identifiant persisté et de `sensitive`. `id` vaut
`null` quand la permission n'est pas encore en base : elle est visible mais pas attachable, ce qui
signale qu'une synchronisation manque plutôt que de la masquer.

Conséquence recherchée : **une ligne insérée à la main en base n'apparaît plus dans l'API**, donc ne
peut plus être attachée à un rôle. C'est ce qui ferme le vecteur de R1 au-delà du retrait des trois
endpoints.

`show` s'adresse désormais par **slug** et non par identifiant : le catalogue est la source, l'`id`
n'est qu'un détail de persistance.

**Le catalogue est passé en argument** au use case, jamais importé depuis `app/` — même principe
qu'en L2. C'est le contrôleur, couche d'assemblage HTTP, qui le fournit.

**`permissions:prune` est livrée mais non exécutée.** Elle refuse de supprimer une permission encore
attachée à un rôle : la clé étrangère étant en cascade, la suppression emporterait l'attribution
sans le dire. En aperçu sur la base de production, **12 permissions seraient retirées** — les 4
slugs de catalogue sans route, les 6 slugs utilisateurs sans endpoint, `ledger.read` et `all`.

**Vérifications** : `tsc` **61** (13 de moins que la baseline, aucune nouvelle) — `eslint` 0 erreur —
tests **538 passés / 5 échecs**.

> **Impact front, à traiter en L5** : `roles.service.ts` appelle encore `POST`, `PUT` et `DELETE` sur
> `/team/permissions`. Ces trois appels rendront 404. La page de gestion des permissions du
> back-office doit disparaître au profit d'une lecture seule.

Le plancher du test de gardes passe de 104 à **101** : retirer trois routes d'écriture réduit le
total à 105. Le test l'a signalé de lui-même, ce qui a forcé à justifier la baisse plutôt qu'à la
subir.

## Lot L7 — Composition des rôles

### État de livraison (2026-08-01)

**Le dernier trou de R1 est fermé.** `syncPermissions` acceptait n'importe quel identifiant : le
CRUD de permissions était retiré, mais **attacher une permission restée en base demeurait
possible** — y compris `all`, dont l'attachement réactiverait le contournement du front.

`RolePermissionGuard.assertBelongsToCatalog` résout les identifiants en slugs et refuse tout ce qui
n'est pas déclaré en code (**422**, `E_UNKNOWN_ROLE_PERMISSION`, permissions refusées nommées).

**Un rôle ne peut plus être vide** (**422**, `E_EMPTY_ROLE_PERMISSIONS`). C'était l'état de `admin`,
`kyc_agent` et `support_agent` : des rôles qui n'ouvraient aucune porte tout en laissant croire à un
accès. Le RBAC business refusait déjà ce cas ; le back-office s'aligne.

À la mise à jour, `permissionIds` absent laisse les permissions inchangées — mais une liste fournie
doit être valide et non vide.

**Les incompatibilités sont portées par les descriptions** (D19). Quatre permissions les mentionnent
désormais : `funding_requests.review`, `funding_settings.manage`, `collection_accounts.manage` et
`wallet_adjustment.execute`. Ces avertissements ne vivaient jusque-là que dans des commentaires de
seeders, invisibles à qui compose un rôle.

**5 tests** couvrent la garde, dont le refus nommé d'une permission hors catalogue.

**Vérifications** : `tsc` **61** (aucune nouvelle) — `eslint` 0 erreur — tests **543 passés /
5 échecs**.

## Lot L4b — Normalisation des slugs

### État de livraison (2026-08-01)

**70 slugs renommés** vers `[<contexte>.]<ressource>.<action>`. Le catalogue passe à **74
permissions** (73 + `roles.manage`, issu de la décomposition de `team.manage`).

Ce que le renommage apporte, au-delà de la forme :

- **Le contexte devient lisible** : `users.transactions.list`, `users.wallets.block`,
  `organisations.members.list` — on voit d'un coup d'œil qu'il s'agit d'un droit restreint à une
  fiche, distinct du registre global.
- **L'action dit ce qu'elle fait** : `list` parcourt, `read` ouvre une pièce, `export` extrait. Les
  doublons singulier/pluriel (`transaction.read` × `transactions.read`) disparaîssent.
- **`tarifications` devient `pricings`** : le seul groupe en français du catalogue, là où le front
  disait déjà `pricings`.
- **Le préfixe `user_` des appareils tombe** : les routes sont `/devices`, la ressource aussi.

**L'ordre des renommages est significatif.** Six couples entrent en collision : `users.read` devient
`users.list` tandis que `user.read` devient `users.read`. La migration libère le nom avant de le
réattribuer ; l'ordre est vérifié à l'écriture (aucune cible en double, aucune source traitée après
sa cible).

**Migration** : `1785000000000_rename_permission_slugs.ts`, réversible. Les affectations aux rôles ne
sont pas touchées — `role_permission` référence un identifiant, pas un slug. Les 12 orphelines sont
ignorées.

**Vérifications** : `tsc` **61** (aucune nouvelle) — `eslint` 0 erreur — tests **543 passés /
5 échecs**.

> **Ordre de déploiement — le plus contraint du chantier.** `permissions:check` signale actuellement
> **65 permissions absentes** : le code porte les nouveaux noms, la base les anciens. La séquence
> n'est pas optionnelle, et le front doit partir dans le même déploiement :
>
> ```
> node ace migration:run        # renomme les 70 slugs en base
> node ace permissions:sync     # crée roles.manage et les manquants
> node ace make:root-role       # réattache le catalogue à root
> node ace permissions:check    # doit sortir en succès
> ```

## Lot L5 — Le front

### État de livraison (2026-08-01)

Dépôt séparé : `apps/aiglesend/admin`, branche `develop`.

**Les 11 énumérations sont alignées.** 34 slugs renommés, 9 supprimés faute de contrepartie
serveur. **Contrôle final : les 39 slugs déclarés par le front existent tous au catalogue** — le
front ne peut plus garder une page derrière un droit que le serveur ignore, ce qui était le
quatrième critère de réussite de l'objectif.

**Le contournement `all` a disparu.** `usePermissions.isSuper` testait un slug que L3 a retiré du
rôle `root` ; `can()` ne connaît plus d'exception. La pastille « Accès total » de la page d'accueil
disparu avec lui — elle n'aurait plus jamais été affichée.

**Le CRUD de permissions est retiré** : `createPermission`, `updatePermission` et `deletePermission`
du service, plus les composants `CreatePermissionModal`, `PermissionFormModal`, `PermissionsHeader`
et le composable `usePermissionForm`. La page devient un catalogue en lecture seule, qui explique
d'où viennent les permissions.

**`sensitive` est exploité** — une pastille « Sensible » dans la table et, surtout, dans l'écran de
composition de rôle. Le `truncate` de la description y a été retiré : L7 y a placé les
avertissements de séparation des tâches, les tronquer les aurait rendus invisibles.

**Une permission sans identifiant n'est pas attachable** : sa case est désactivée. Le cas se
produit quand le catalogue devance la base — c'est le signal qu'une synchronisation manque.

**Dix fichiers utilisaient des slugs en dur**, hors des énumérations — noté après un premier
contrôle incomplet qui ne portait que sur les fichiers de déclaration :

| Fichier | Slugs |
|---|---|
| `core/config/modules.ts` | 16 |
| `core/components/sidebar/AppSidebar.vue` | 10 |
| `transaction/composables/useTransactionPermissions.ts` | 5 |
| `core/config/settings-nav.ts` | 3 |
| `kyc/pages/settings/kyc-levels/index.vue` | 2 |
| `device/pages/devices/{index,[id]}.vue`, `members/mocks.ts`, `organisation/.../OrganisationInfoTab.vue`, `user/pages/support/index.vue` | 1 chacun |

En l'état, la barre latérale aurait masqué la plupart des menus. Deux cas ont demandé un choix :
`users_support.read` n'a aucun équivalent — la page d'assistance passe sous `users.list` ; et
l'écran des paliers de vérification gardait `kyc.manage`, remplacé par `kyc_levels.manage`.

**Plus aucun littéral de permission dans le front.** Un second passage a montré que corriger les
valeurs ne suffisait pas : `core/config/modules.ts`, `settings-nav.ts` et `AppSidebar.vue` écrivaient
20 slugs en dur, et 18 appels à `can()`/`canAny()` en portaient d'autres. Tous passent désormais par
les énumérations de layer — c'est le pendant, côté front, de ce que le typage marqué impose côté API.

**Deux layers manquaient leur déclaration** : `device` n'en avait aucune (slugs en dur dans ses
pages) — `DevicePermissions` créée ; et les paliers de vérification n'étaient pas déclarés —
`KycLevelPermissions` ajoutée. `auth` et `home` n'utilisent aucune permission : rien à déclarer.

**Gardes mortes trouvées et réparées** — elles ne s'affichaient plus, ou n'auraient jamais pu :

| Garde | Diagnostic |
|---|---|
| `canAny('all')` × 4 | onglets Comptabilité et Rapport — morts depuis que L3 a retiré `all` de `root` |
| `canAny('all, user_wallet.read')` | onglet Portefeuille — idem, plus un slug renommé |
| `can('transaction.ledger')` | **slug inexistant, préexistant** — la garde n'a jamais fonctionné |
| `canAny('transaction.read, user_transaction.read')` | second slug supprimé, **préexistant** |
| `pricings.read` sur la page liste | slug valide mais mauvais sens : c'est le détail d'une tarification, pas la liste |

Ce dernier cas mérite d'être noté : le slug étant au catalogue, **aucun contrôle automatique ne
pouvait le signaler**. Seule la relecture du sens l'a fait apparaître.

**`users.search` créée — correction d'une régression.** `users_support.read` avait d'abord été
reporté sur `users.list`, ce qui fusionnait deux publics : l'assistance obtenait l'annuaire complet.
Or parcourir l'annuaire et retrouver un client précis ne sont pas le même pouvoir. La recherche
accepte désormais `users.list` **ou** `users.search` ; un agent d'assistance reçoit
`users.search` + `users.read` — il trouve un client et ouvre sa fiche, sans jamais voir les autres.

L'intention existait déjà : `users_support.read` était en base. Mais aucun endpoint ne la vérifiait,
donc la garde était cosmétique — un agent qui n'aurait eu qu'elle n'aurait pu appeler aucune API.

**`useTransactionPermissions` est supprimé** (D24). Ses 7 entrées masquaient la permission derrière
un nom métier ; les 3 composants qui l'utilisaient appellent désormais `can(TransactionPermissions.Y)`
là où la garde s'applique. Deux constats l'ont motivé : c'est ce composable qui dissimulait le slug
inexistant `transaction.ledger`, et sa seule entrée composite — `canReadTransaction`, celle qui
justifiait son existence — était destructurée sans être utilisée.

**Leçon à retenir** : vérifier les déclarations ne suffit pas — il faut chercher les **usages**, et
même un slug valide peut garder la mauvaise page. Toute indirection entre la garde et la permission
qu'elle exige finit par masquer une erreur.

**Vérification** : `nuxi typecheck` — **134 erreurs, aucune sur les fichiers modifiés**, inchangé
avant et après la correction des littéraux. La baseline annoncée était 132 ; l'écart n'est pas
attribuable, le dépôt portant déjà 62 fichiers modifiés avant intervention.

## Correctif hors lot — routes admin sans authentification (2026-08-01)

Découvert en explorant L6. **Sans rapport avec le RBAC** : ce n'est pas une permission qui manquait,
c'est l'authentification.

Le groupe `/api/admin` de `start/admin_routes.ts` n'applique **aucun middleware** — chaque
sous-groupe déclare le sien. Deux l'avaient oublié :

| Groupe | Routes | Ce qui était exposé sans jeton |
|---|---|---|
| `app_version_routes.ts` | 5 | `minVersion`, `criticalUpdate` et **`downloadUrl`** servis au mobile par `check_app_update_use_case` : de quoi immobiliser la flotte, ou détourner le lien de mise à jour vers une application contrôlée par un tiers |
| `services_management_routes.ts` | 24 | types de service, méthodes de paiement, providers, **tarifications** (`service_provider_methods` : frais fixes, pourcentages, montants minimums), contacts |

Vérifié par requête : `POST /services-management/service-types` sans jeton répondait **422** — donc la
requête était traitée, seule la validation du payload la rejetait — et
`PUT /services-management/service-provider-methods/1` répondait **200**.

**Correctif** : `.use(middleware.auth({ guards: ['admin'] }))` sur les deux groupes.
**Test** : `tests/functional/team/admin_routes_authentication.spec.ts` — 8 cas couvrant les surfaces
d'écriture les plus exposées.
**Audit** : les 15 groupes de `admin_routes.ts` ont été passés en revue ; tous portent désormais
`middleware.auth`, sauf `admin_auth_routes` (login, refresh, setup-password, verify-otp), légitimement
public.

**Écriture involontaire en production** : le test a été écrit sans transaction d'isolation, et son
`PUT` a atteint la base avant le correctif. `merge()` utilisant `data.X ?? item.X`, aucune valeur de
tarification n'a changé — seuls `updated_at` de la ligne 1 et un événement d'audit `SPM_UPDATED`
avec `actorId: null` en portent la trace. Illustration directe de [[R11]].

## Matière pour L6 — revues de gardes

### Espace admin des organisations (revue du 2026-07-31)

**Serveur : 7 endpoints, 2 permissions.**

| Endpoint | Permission exigée | Ce qu'il expose |
|---|---|---|
| `GET /organisations` | `organisations.read` | liste + compteurs |
| `GET /organisations/search` | `organisations.read` | recherche |
| `GET /organisations/:id` | `organisations.read` | fiche |
| `GET /organisations/:id/members` | `organisations.read` | **identité des membres** (personnes tierces) |
| `GET /organisations/:id/roles` | `organisations.read` | rôles internes de l'organisation |
| `GET /organisations/:id/wallet-stats` | `organisations.read` | **solde et volumes** du marchand |
| `PATCH /organisations/:id/payable` | `organisations.manage` | suspend l'encaissement |

Consulter le solde d'un marchand et lister l'identité de ses membres relèvent du même droit que
voir la liste des organisations.

**Front : 7 permissions déclarées, 2 utilisées, 1 fantôme.** `organisations.read` garde la page
liste ; `organisation.read` garde la fiche mais **n'existe ni côté serveur ni en base** — slug
inventé par le front. `organisation.block`, `organisation_members.read`, `organisation_wallet.read`,
`organisation_transactions.read` et `organisation_kyb.read` sont déclarées sans aucun usage : les
onglets membres, wallet, transactions et KYB n'ont pas de garde `Can` et s'affichent pour tous.
Seuls les onglets appartenant à d'autres features (`mass-payout`, `funding`, `ledgers`) sont
réellement gardés.

**Quatre appels front sans contrepartie serveur** — `organisations.service.ts` :

- `GET /organisations/stats` : serait **capté par `/:id`** avec `id = "stats"`, seule `/search`
  étant déclarée avant.
- `PUT /organisations/:id/block` et `/activate` : lot **O3**, non livré.
- `GET /organisations/:id/kyb` : l'onglet se déclare lui-même « aperçu mocké, module backend à
  venir ».
- `GET /organisations/:id/transactions` : onglet transactions.

**Catalogue cible proposé** (à poser en L6, aux slugs de la convention définitive) :

```
organisations.list                Parcourir les organisations et leurs compteurs
organisations.read                Consulter la fiche d'une organisation
organisations.members.list        Voir les membres et leur identité
organisations.roles.list          Voir les rôles internes de l'organisation
organisations.wallets.read        Voir le solde et les volumes du marchand      [sensible]
organisations.transactions.list   Voir les transactions de l'organisation
organisations.payable             Ouvrir ou suspendre l'encaissement            [sensible]
```

`organisations.block` et `organisations.kyb.read` sont **volontairement absentes** : elles
garderaient des endpoints qui n'existent pas encore (O3, module KYB). Les déclarer en ferait des
fantômes — ce que ce chantier combat. Elles appartiennent à leurs lots respectifs.

## Inconnues

| # | Inconnue | Résolution |
|---|----------|-----------|
| I1 | Contenu réel de la table `permissions` | **Résolue le 2026-07-31** par `permissions:sync --dry-run` — cf. « Inventaire réel de la base ». 38 slugs hors catalogue, 7 slugs du catalogue absents, `all` présent. |
| I3 | Quels **rôles** portent `all`, `root` et les 38 slugs hors catalogue | **Résolue le 2026-07-31** par `roles:inventory` : un seul rôle existe, `root`, portant 51 permissions dont `all`, tenu par les 2 seuls comptes d'administration. Aucun rôle métier. |
| I2 | L'inférence Adonis propage-t-elle un type non primitif au 3ᵉ argument de `middleware.permission()` ? | **Résolue le 2026-07-31** : elle propage. Un fichier de routes converti ne produit aucune erreur, un fichier resté en chaînes produit `Type 'string' is not assignable to type 'PermissionDefinition'`. Le repli est inutile. |

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