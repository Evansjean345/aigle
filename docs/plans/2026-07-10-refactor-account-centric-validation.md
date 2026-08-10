---
type: design
statut: livré — É0 à É5, hors retrait de `wallet.user` (suivi en R4)
derniere_maj: 2026-08-05
session_courante: —
prochaine_action: rien ici — le reliquat d'É5 est tracé en R4 (endgame D8)
# Constaté le 2026-08-05 : `Account` relocalisé en `core/identity/account` (É1),
# `AccountStandingService` et `AccountService` en place (É2), `PartyValidator` consommé par les
# handlers external_in/out/e2e (É3, É4). É5 partiellement fait : `AccountValidationService` ne porte
# plus que `validateDevice` et `verifyPinForUser` — la validation statut/wallet en est bien sortie —
# mais `wallet.user` subsiste dans trois handlers d'initiation. Ce reliquat est R4, explicitement
# différé à l'endgame D8, et n'appartient plus à ce design.
---

# Refactor account-centric — validation ancrée sur le Compte (+ R5)

Ce lot est un **refactor** : la validation argent (statut, blocage, limites) cesse de s'appuyer
sur le `User` (via `wallet.user`) et s'ancre sur le **Compte**, qui devient la **source de mutation
du wallet** et **porte** son niveau/statut/limites. Il unifie KYC (user) et KYB (org) sous
`account → niveau → limites` — c'est-à-dire **R5 tiré en avant**.

> Méthode : on brainstorme **session par session** (S1→S7). Chaque session est **proposée puis
> validée** avant de passer à la suivante. **Rien n'est codé** tant que le brainstorming n'est pas
> bouclé. Les migrations seront lancées par l'utilisateur (je ne crée que les fichiers).

## Agenda

| Session | Sujet | État |
|---|---|---|
| **S1** | Cadrage & invariants | ✅ validée |
| S2 | Modèle de données du Compte (statut/niveau/limites, ancrage KYC/KYB) | ✅ validée |
| S3 | Frontières & responsabilités (qui alimente le compte, sans couplage core→produit) | ✅ validée (β) |
| S4 | Sémantique de validation par compte (contrôles, ordre, cas marchand) | ✅ validée |
| S5 | API & orchestration (PartyValidator par accountId, refonte services, use cases) | ✅ validée |
| S6 | Migration & compat (garder vert) | ✅ validée |
| S7 | Découpage tracer-bullets + tests | ✅ validée |

---

## Garde-fous d'architecture *(règles projet chargées — à respecter à chaque étape)*

Sources : `docs/rules/2026-07-05-type-placement-rules.md`, `docs/rules/2026-04-16-dto-conventions-rules.md`,
`.dependency-cruiser.cjs`.

- **`core-ne-depend-pas-du-produit` (ERROR)** : le core (identity/money) **n'importe JAMAIS** le
  produit. → β : le **produit appelle** `AccountService` (identity) ; les events (`AccountOpened`,
  `UserKycStatusUpdated`) sont **émis/consommés en core**, jamais un event produit importé par le core.
- **`produit-consomme-core-par-service` (ERROR)** : le produit consomme le core **uniquement** via
  `application/services` + DTOs — **jamais** `domain/models`, `domain/interfaces/*repository`,
  `infrastructure/`. → le produit appelle **`AccountService`** (service), **jamais** `AccountRepository`
  ni le modèle `Account`. *(C'est l'anti-pattern rencontré : `UserRepository` injecté hors contexte.)*
- **`money ↔ identity` = WARN, `domain/models` EXEMPTÉ (shared kernel)** : les relations Lucid
  inter-contexte (ex. `wallet.accountId → Account`) sont **légitimes** au niveau `domain/models`.
  La cible pour la couche application = **« par ID/contrat »** → `getStanding(accountId)` renvoyant un
  **Result minimal** est exactement la forme visée (résorbe le WARN, pas de modèle exposé).
- **β améliore la conformité** : il **retire** la fuite actuelle `identity → money`
  (`AccountValidationService` importe `WalletStatus`) en ramenant le check wallet dans money.
- **Placement des types** : `getStanding` renvoie un **`AccountStandingResult` (interface)** ;
  `Command`/`Query`/`Result` selon la couche propriétaire ; DTOs dans `application/dtos/` (dossier
  `dtos/`, Result=interface, suffixes par rôle). Jamais de modèle `User`/`Organisation` exposé hors
  contexte — projection minimale (cf. `UserDirectoryService`).
- **Lentille permanente** : [[layer-independence-principle]] + [[product-core-service-port]] à chaque décision.

## S1 — Cadrage & invariants  *(proposition, à valider)*

### Objectif du lot
Rendre la validation argent **account-centric** : blocage + limites + statut évalués **par
`accountId`**, le compte portant son **niveau** (palier) et son **statut**. Unifier KYC (user) et
KYB (org) sous `account → niveau → limites`. Retirer `wallet.user` de la validation.

### Périmètre — IN
- `Account` **porte** son **statut** (money) et son **niveau/palier** (+ ancrage des docs de
  vérification par `account_id`).
- `PartyValidator` / `AccountValidationService` / `TransactionLimitValidationService` deviennent
  **account-centric** (entrée par `accountId`, plus de `User` en paramètre).
- Les 4 use cases money (`external_in`, `external_out`, `external_to_external`, `internal_move`)
  passent un **`accountId`**, ne touchent plus `wallet.user` ni un repo identité.
- Le **label d'affichage** (nom user / nom org marchand) est **passé depuis la résolution**
  (QR/téléphone), pas dérivé dans le core.
- Migration data : le compte porte niveau/statut, **backfill** depuis user/org.

### Périmètre — OUT (explicitement hors de ce lot)
- **Drop** des colonnes `user_id`/`users_uid` sur `wallets`/`transactions` → **R4 endgame**, après.
- Bascule de la relation `belongsTo(User)` / scope `search` admin → **R4**.
- La **feature produit** paiement `aiglesend → marchand` → reprend **après** ce refactor.
- Refonte des notifications par app (**R2**).

### Invariants non négociables
1. **Indépendance des couches** : le core money **ne dépend JAMAIS** du produit (aiglebusiness).
   Identity et produit **alimentent** le compte ; le core **lit** le compte. *(lentille [[layer-independence-principle]])*
2. `accountId == usersUid` pour un compte user (dérivé, maintenu jusqu'au R4).
3. Un **compte marchand** = `account` sans user (org), wallet rattaché au compte.
4. **Atomicité argent** (tout-ou-rien) préservée à chaque étape.
5. **Auth reste par user** : PIN/OTP/anti-brute-force restent ancrés user. Le compte porte le
   **blocage/limites argent**, pas l'auth.
6. **Vert permanent** : la caractérisation (w2w, deposit, transfert, inter, checkout) reste verte
   à chaque commit.

### Glossaire
- **Compte (`Account`)** : pivot `ownerType` + `ownerRef` ; porte le wallet et — désormais — son
  statut/niveau/limites.
- **Propriétaire (owner)** : `user` (usersUid) ou `organisation` (orgId).
- **Niveau / palier (level)** : classe du compte déterminant ses limites (unifie tier user + niveau org).
- **Statut de compte (money)** : actif / bloqué / … — distinct du **statut d'auth** du user.
- **KYC / KYB** : vérifications d'identité (user) / d'entreprise (org) → **docs ancrés `account_id`**,
  déterminent le niveau.
- **Limites** : plafonds (volume quotidien/mensuel, montant unitaire) **par niveau de compte**.

### Décisions S1  *(validées 2026-07-10)*
- **P1 → migration data DANS ce lot** : le compte porte niveau/statut + backfill font partie du lot.
- **P2 → OK** : l'auth reste **par user** (PIN/OTP/anti-brute-force) ; seul le **blocage/limites
  argent** passe au compte.
- **P3 → statut DISTINCT** : le **compte a son propre statut money** (indépendant du statut d'auth
  du user). Le blocage argent est porté par le compte, pas dérivé du user.

---

## S2 — Modèle de données du Compte  *(proposition, à valider)*

### Ancrage dans l'existant (ce qui est DÉJÀ là)
- **`KycLevel`** (table `kyc_level`) = **déjà** la table « niveau → limites » :
  `{ level, singleLimit, dailyLimit, monthlyLimit, balanceLimit, isActive }`. Table de référence
  partagée (niveaux 0/1/2…).
- **User** porte : `status: UserStatus` (active/inactive/**blocked**), `kycLevel` (la valeur du
  niveau) + `keyLevel: BelongsTo<KycLevel>` (la ligne de limites). Le volume est tracké par `usersUid`.
- **Organisation** (produit) porte : `status: OrganisationStatus`, `level: OrganisationLevel`
  (LEVEL_0/1/2). **Pas** de table de limites org aujourd'hui.
- **`Account`** : `{ accountId, ownerType, ownerRef }` — rien d'autre.

### Proposition : ce que `Account` porte désormais
1. **`status: AccountStatus`** (money) — enum dédié (`ACTIVE` / `BLOCKED` / …), **distinct** du
   statut user/org (décision P3). C'est le **blocage argent**. Défaut `ACTIVE`.
2. **`level`** — la **valeur de niveau** du compte, résolvant vers la table de limites
   (`single/daily/monthly/balance`). Remplace `user.kycLevel` comme source pour la validation argent.
3. Le **volume** (quotidien/mensuel) est clé par **`accountId`** (décision reportée à S4, mais le
   modèle doit le permettre).

### Table de limites — réutiliser `KycLevel` ou généraliser ?
Le refactor unifie KYC (user) et KYB (org) sous `account → niveau → limites`. La table existe déjà
mais s'appelle `kyc_level` (connotée KYC/user). Deux pistes :
- **(A) Réutiliser `kyc_level` tel quel** comme table « niveau de compte → limites » (le compte
  référence un `level`). Churn minimal. Renommage `kyc_level → account_level` reporté.
- **(B) Généraliser maintenant** : renommer `kyc_level → account_level` (ou nouveau `AccountLevel`),
  **unifier les échelles** KYC (user) et niveaux org sous une seule grille de niveaux de compte.
  Nommage propre, migration plus lourde.

### Ancrage des docs KYC/KYB
- Aujourd'hui : docs **KYC** (identity) rattachés au **user**. **KYB** (org) = à construire.
- Cible R5 : **docs ancrés `account_id`** ; leur vérification **fait monter le `level` du compte**.
- Question : les docs KYC **migrent** vers `account_id`, ou **gagnent `account_id`** en plus du
  `user_id` (compat) ?

### Échelles de niveau (le sous-nœud dur)
Niveaux user (`KycLevelState` : 0/1/2…) et niveaux org (`OrganisationLevel` : LEVEL_0/1/2) sont deux
échelles distinctes. Les unifier en **une grille de niveaux de compte** (chaque niveau → une ligne
de limites) est le cœur de S2/S3. Question : **une seule échelle** unifiée, ou **deux échelles**
(user-KYC / org-KYB) qui pointent chacune vers des lignes de limites ?

### Points à trancher pour clore S2
- **P4** — Table de limites : piste **(A) réutiliser `kyc_level`** ou **(B) généraliser en
  `account_level`** maintenant ?
- **P5** — Échelle de niveaux : **une échelle unifiée** compte, ou **deux échelles** (KYC user /
  KYB org) vers des limites ?
- **P6** — Docs de vérification : **migrer** vers `account_id` ou **ajouter `account_id`** en compat
  (garder `user_id` jusqu'au R4) ?
- **P7** — `AccountStatus` : quelles valeurs au départ (`ACTIVE` / `BLOCKED` suffisent, ou aussi
  `SUSPENDED`/`CLOSED`) ? Et au backfill, on **seed** `account.status` depuis `user.status`/`org.status` ?

### Décisions S2  *(validées 2026-07-10)*
- **P4 → A** : **réutiliser `kyc_level`** comme table « niveau de compte → limites ». Renommage
  `account_level` reporté (hors lot).
- **P5 → A** : **une seule échelle** de niveaux de compte (unifie KYC user + KYB org).
- **P6 → A** : les docs de vérification **gagnent `account_id`** (compat), `user_id` conservé jusqu'au R4.
- **P7 → A** : `AccountStatus` = **`ACTIVE` / `BLOCKED`** au départ. Backfill : **seed** depuis
  `user.status` / `org.status`.

> **⚠️ RÉVISION par la décision S3/β (2026-07-10)** : `Account` passe dans **identity** et le **gel
> argent reste sur `WalletStatus`** (existant). Conséquences :
> - **P3/P7 CADUQUES** : **pas** de nouvelle colonne `account.status` money. Le compte (identity)
>   porte **le niveau** (vérification) ; le **gel argent** = `WalletStatus` (money) ; le **statut
>   party** (blocage auth) reste `user.status` / `org.status`.
> - `Account` porte donc : `{ accountId, ownerType, ownerRef, level }` (+ ancrage docs KYC/KYB
>   `account_id`). Backfill : `account.level` seedé depuis `user.kycLevel` / `org.level`.
> - La table de limites `kyc_level` (P4-A) **reste** la grille `niveau → limites` (identity la possède déjà).

### Addendum S2 — Stratégie de nommage des niveaux  *(validé 2026-07-10 — N2)*
Particulier (KYC), marchand et entreprise (KYB) partagent `kyc_level`. Le segment **marchand vs
entreprise** vient de `OrganisationAccountType` (**produit**) → il doit être **stocké**, pas dérivé
à la lecture (le core ne lit pas le produit).

- **N2 retenu** : `kyc_level` gagne une colonne **`segment`** (`particulier` | `marchand` |
  `entreprise`) ; **clé unique = `(segment, level)`**. Le **compte** porte **`segment` + `level`**.
- Attribution du segment : **user → `particulier`** (posé par identity au KYC) ; **org →
  `marchand`/`entreprise`** (posé par le **produit** au provisioning, depuis `org.accountType`).
- **Plafonds `null` = illimité** : une limite à `null` **n'est pas contrôlée** (ex. `entreprise`
  level 2 sans plafond). La validation ignore les caps `null`.

```
kyc_level:  segment       level  single  daily  monthly  balance
            particulier   1      …       …      …        …
            marchand      1      …       …      …        …
            entreprise    2      null    null   null     null     (illimité)
account (identity): { accountId, ownerType, ownerRef, segment, level }
```
## S3 — Frontières & responsabilités  *(proposition, à valider)*

### Le nœud
Le compte porte statut + niveau, mais ces infos **naissent ailleurs** : le niveau vient de la
vérification (KYC user / KYB org), le blocage vient d'identity (user) ou du produit (org). Il faut
**alimenter le compte** sans que le **core money dépende du produit** (invariant #1).

### Sens des dépendances (l'état actuel)
- Money **dépend déjà** d'identity (validation, wallet↔user). Donc **identity → money** créerait un
  **cycle** → à éviter.
- **Produit → core** est autorisé (le produit consomme le core). Pas de cycle.
- Money ne connaît **rien** du produit.

### Proposition : écriture (qui alimente le compte)
- **Money possède `Account`** et expose un **port d'écriture** (service money), ex.
  `AccountService.setLevel(accountId, level)` / `setStatus(accountId, status)`. C'est le seul point
  de mutation du statut/niveau de compte.
- **Compte USER** ← alimenté **par événements** : le module compte (money) **écoute** les events
  identity **déjà existants** — `UserKycStatusUpdated` → `account.level`, `UserStateChanged` →
  `account.status`. Direction **money → identity** (import de l'event), **même sens** que les deps
  actuelles → **pas de cycle**. Identity n'appelle pas money.
- **Compte ORG (marchand)** ← alimenté **par appel** : le **produit** (aiglebusiness), au
  provisioning et aux futurs changements KYB/statut org, **appelle** `AccountService` (produit →
  core, autorisé). Pas d'event produit (le core ne l'importerait pas de toute façon).

### Proposition : lecture (validation)
- La validation **lit le compte** (money possède `Account`) : `account.status` (blocage) +
  `account.level` → limites via `kyc_level` (money lit déjà cette table). Aucune dépendance produit.

### Provisioning (niveau/statut initial)
- `AccountProvisioningService.openFor(...)` **seed** l'état initial : `status = ACTIVE`, `level =
  niveau de base`. Les events (user) / appels (org) **font monter** le niveau ensuite. *(Alternative :
  l'appelant passe le niveau initial au provisioning.)*

### Schéma de synthèse
```
identity  --(events: UserKycStatusUpdated, UserStateChanged)-->  [money: AccountService] --> account.{level,status}
produit   --(appel: AccountService.setLevel/setStatus)-------->  [money: AccountService] --> account.{level,status}
money (validation) --(lecture)--> account.status + account.level -> kyc_level (limites)
```

### Points à trancher pour clore S3
- **P8** — Compte **user** alimenté **par events** (money écoute `UserKycStatusUpdated` /
  `UserStateChanged`) — on acte ? *(évite le cycle identity→money)*
- **P9** — Compte **org** alimenté **par appel produit** à `AccountService` (produit→core) — on acte ?
- **P10** — Port d'écriture = **`AccountService` (money)** avec `setLevel` / `setStatus` (+ blocage/
  déblocage) — nom/emplacement OK (`core/money/account/application/services`) ?
- **P11** — Provisioning : **base level + ACTIVE puis sync**, ou l'appelant **passe le niveau
  initial** ?

### Décisions S3  *(validées 2026-07-10 — variante β retenue)*
La proposition α (Account dans money + sync par events) est **abandonnée** au profit de **β** :

- **Account vit dans `identity`** (`app/core/identity/...`). C'est le **standing du party** : il unifie
  KYC (user) et KYB (org) → **vérification**, donc chez identity. Source **unique** du niveau.
- **`account.level`** est fixé **en direct** par identity au moment de la vérification (KYC user
  in-context ; KYB org via appel produit). **Pas de pont événementiel de sync du niveau** → P8
  caduque pour le user.
- **Gel argent = `WalletStatus`** (money, existant). Pas de statut money sur le compte.
- **Statut party** (blocage auth) = `user.status` / `org.status` (identity/produit).
- **Provisioning — RÉVISÉ (É1, unidirectionnel `money → identity` uniquement ; option 2)** :
  identity **possède la création du compte**, money **réagit** pour le wallet — identity n'appelle
  **jamais** money.
  - **compte USER** : `register` (identity) crée `user` **+ le compte** (in-context, **même trx →
    user+compte atomiques**) puis **émet `AccountOpened`**.
  - **compte ORG** : le **produit appelle** `AccountService.openAccount(ORG, orgId, segment, level)`
    (identity) — produit→core autorisé ; identity crée le compte + émet `AccountOpened`.
  - **money écoute `AccountOpened` → crée le wallet** (`WalletService.createForAccount`). Direction
    `money → identity` (import d'event + lecture du modèle `Account`, shared kernel). **Aucun
    `identity → money`.**
  - `Account` **modèle** + **création** + **standing** (`getStanding`/`setLevel`) = **identity**.
    money ne fait que **lire** le compte (validation) et **créer le wallet** (sur event).
  - **Filet anti-régression d'atomicité** (compte↔wallet éventuel) : `createForAccount` **idempotent**
    + **self-heal lazy** — si une opération money résout un compte **sans wallet**, elle le crée à la
    volée. Aucun compte ne reste sans wallet.
- **Validation reste en money** : elle seule connaît volume + solde + `WalletStatus`. Elle **lit** un
  **port de lecture identity** `AccountStandingService.getStanding(accountId)` → `{ level, limites,
  statut party }`. Sens money→identity (existant) → **pas de cycle**.
- **Écriture** : identity expose `AccountService` (`openAccount`, `setLevel`, gestion statut party).
  Le produit l'appelle pour l'org (produit→core, autorisé).

**Schéma β**
```
identity  : Account{accountId, ownerType, ownerRef, segment, level} + AccountService(write) + AccountStandingService(read) + émet AccountOpened
produit   : org → identity.AccountService.openAccount/setLevel
money     : Wallet{accountId, balance, WalletStatus} ; écoute AccountOpened → crée wallet
validation (money) : lit identity.AccountStandingService.getStanding(accountId) + volume(accountId) + wallet(balance, WalletStatus)
```

**Dépendances** : money→identity (lecture standing + event AccountOpened) = sens **déjà existant**.
Identity ne dépend **pas** de money. Produit→core autorisé. **Aucun cycle, aucun core→produit.**
## S4 — Sémantique de validation par compte  *(proposition, à valider)*

### Entrée (orchestrée en money)
`validate({ accountId, amount, transactionType, direction, isRecipient })`.

### Briques de contrôle disponibles
- **(money)** `WalletStatus` actif — **gel argent**.
- **(identity, via `getStanding`)** **statut party** actif — blocage auth/vérification (`user.status`
  / `org.status`).
- **(identity, via `getStanding`)** **niveau → limites** `{ single, daily, monthly, balance }`.
- **(money)** **volume**(`accountId`) quotidien/mensuel + **solde** wallet.

### Contrôles par rôle
- **Émetteur (DEBIT)** : wallet actif **+** party actif **+** limites **complètes**
  (`single`, volume `daily`/`monthly`, `balance` ≥ requis).
- **Destinataire user (CREDIT, `isRecipient`)** : wallet actif **+** party actif **+** limites de
  **réception** (comme aujourd'hui `isRecipient=true` : plafonds entrants).
- **Destinataire marchand (org, CREDIT)** : wallet actif **+** party(org) actif **+** *(à trancher :
  limites de réception KYB, ou rien)*.

### Ce que `getStanding(accountId)` renvoie (Result minimal identity)
`{ level, limits: { single, daily, monthly, balance }, partyStatus }` — projection, jamais le
modèle `User`/`Organisation`.

### Points à trancher pour clore S4
- **P12** — **Marchand qui reçoit** : applique-t-on des **limites de réception** (via son niveau
  KYB) ou seulement **wallet + party actifs** (comme le checkout MVP actuel) ?
- **P13** — Le jeu de contrôles par rôle ci-dessus est-il correct ? (en particulier : le
  **destinataire user** garde ses **limites entrantes** actuelles ?)
- **P14** — La forme de `getStanding` (`{ level, limits, partyStatus }`, Result minimal) convient-elle ?

### Décisions S4  *(validées 2026-07-10)*
- **P12 → limites de réception PAR NIVEAU KYB** : un marchand qui reçoit **a une limite selon son
  niveau**. `marchand = level 1` (limité), `entreprise = level 2` (sans limite). Le destinataire se
  valide **uniformément** (wallet + party + limites du niveau), user comme org — **plus de cas
  spécial « marchand = wallet seul »**.
- **P13 → contrôles par rôle confirmés** ; le destinataire **user** garde ses **limites entrantes** actuelles.
- **P14 → OK** : `getStanding` renvoie un **Result minimal** (`{ level, limits, partyStatus }`) — money
  ne prend que ce dont il a besoin.

> Conséquence pour le **checkout** (external_in) : le destinataire marchand est désormais validé via
> `getStanding` (statut org + limites du niveau KYB), **et non plus** `wallet.status` seul.
## S5 — API & orchestration  *(proposition, à valider)*

### Cible : `PartyValidator` (money) devient un orchestrateur par `accountId`
```
PartyValidator.validate({ accountId, amount, transactionType, direction, isRecipient }):
  standing = identityAccountStanding.getStanding(accountId)   // {level, limits, partyStatus}
  1. partyStatus actif ?        (sinon → blocage)              // donnée identity
  2. WalletStatus actif ?       (wallet by accountId, money)   // gel argent
  3. limitValidation.validate({ accountId, amount, limits: standing.limits, direction, isRecipient })
                                 // volume(accountId) + solde wallet, money
```

### Services touchés
- **`AccountStandingService`** — **NOUVEAU**, dans **identity** (read port). `getStanding(accountId)`
  → résout `Account` (identity) → owner → `{ level, limits (via kyc_level), partyStatus }`. Result minimal.
- **`AccountValidationService`** (identity) — **décomposé** : garde l'**auth** (device, PIN — invariant
  #5) ; sa partie « statut + wallet » disparaît (statut party → `getStanding` ; wallet → money).
- **`TransactionLimitValidationService`** (money) — **refactor** : entrée `{ accountId, amount, limits,
  direction, isRecipient }`. Ne lit **plus** `user.keyLevel` (les `limits` viennent du standing) ;
  volume clé **`accountId`**.
- **`PartyValidator`** (money) — injecte désormais `AccountStandingService` (identity) + `WalletService`
  (money) + `TransactionLimitValidationService` (money). Plus de `User` en entrée.

### Impact sur les 4 use cases money
- `external_in` / `external_out` / `external_to_external` / `internal_move` : passent un **`accountId`**
  à `PartyValidator`. Le `resolveWallet` ne charge **plus** l'user (`getByAccountId` seul). Plus de
  `wallet.user`.
- **Label d'affichage** (descriptions/paiement) : **passé dans `command.metadata`** (`recipientLabel`)
  depuis la **résolution produit** (nom user via `UserDirectoryService` ; **nom org via l'alias
  payable du QR**). Le core ne dérive plus le nom. *(C'est le déclencheur initial de tout ce lot.)*

### Points à trancher pour clore S5
- **P15** — Forme de `PartyValidator` (orchestrateur `accountId` : standing → party + wallet + limites) — OK ?
- **P16** — `AccountStandingService` (identity, read port) — nom/emplacement
  (`core/identity/.../application/services`) OK ?
- **P17** — `TransactionLimitValidationService` refactor (entrée `accountId` + `limits` injectées,
  volume par `accountId`, ne lit plus `user.keyLevel`) — OK ?
- **P18** — Label passé dans `command.metadata.recipientLabel` depuis la résolution produit — on acte ?
- **P19** — `AccountValidationService` décomposé (auth device/PIN conservés ; statut+wallet retirés) — OK ?

### Décisions S5  *(validées 2026-07-10)*
- **P15 → OK** : `PartyValidator` (money) = orchestrateur `validate({ accountId, amount, type,
  direction, isRecipient })` (standing → party + WalletStatus + limites).
- **P16 → OK** : `AccountStandingService` (identity, read port) `getStanding(accountId) → { segment,
  level, limits, partyStatus }`.
- **P17 → OK** : `TransactionLimitValidationService` (money) refactoré — entrée `accountId` + `limits`
  injectées (caps `null` ignorés), volume par `accountId`, ne lit plus `user.keyLevel`.
- **P18 → OK** : label d'affichage via `command.metadata.recipientLabel` depuis la résolution produit.
- **P19 → OK** : `AccountValidationService` décomposé (auth device/PIN conservés ; statut+wallet retirés).
## S6 — Migration & compat  *(proposition, à valider)*

### Principe : additif + backfill, AUCUN drop (compat jusqu'au R4)
On **ajoute** des colonnes et on **backfill**. On ne **retire rien** (ni `user_id`/`users_uid`, ni
`user.kycLevel`/`user.status`, ni la relation `belongsTo(User)`) → ça reste **R4 endgame**. La
relocalisation d'`Account` money→identity est un **déplacement de code**, pas de table.

### Migrations (fichiers créés par moi, **lancées par toi**)
1. **`accounts`** += `segment` (enum `particulier|marchand|entreprise`) + `level` (int/état).
   Backfill :
   - compte **user** → `segment='particulier'`, `level = user.kycLevel` ;
   - compte **org** → `segment = org.accountType` (marchand/entreprise), `level = org.level` (0/1/2).
2. **`kyc_level`** += `segment` ; **unique `(segment, level)`**. Backfill : lignes existantes →
   `segment='particulier'`. **Seed** des lignes org : `(marchand, 1)`, `(entreprise, 0)`,
   `(entreprise, 2)`… (plafonds, `null`=illimité).
3. **`kyc_documents`** += `account_id` (compat, P6-A) + backfill depuis le user. (KYB à venir, hors lot.)

### Compat / transition
- `user.kycLevel` / `user.status` **restent** (autres usages) ; la **validation** lit désormais le
  **compte** (identity). Pendant la transition, les deux coexistent (le compte fait foi pour l'argent).
- **Volume** : clé `usersUid` → `accountId`. Pour un user `accountId == usersUid` → **mêmes clés**,
  **aucune migration de données** (Redis) ; rétro-compatible.
- Relocalisation `Account` : le modèle + `AccountProvisioningService` passent en `identity` ; la table
  `accounts` ne bouge pas. `wallet.accountId` / `transaction.accountId` (money) référencent un compte
  identity **sans FK** (comme `usersUid` aujourd'hui).

### Points à trancher pour clore S6
- **P20** — On confirme **zéro drop** dans ce lot (compat maximale, drops = R4) ?
- **P21** — Mapping backfill : **org → `(accountType, org.level)`**, **user → `(particulier,
  user.kycLevel)`** — correct ?
- **P22** — La grille `(segment, level) → limites` pour marchand/entreprise : **seed via seeder**
  (valeurs à fournir par toi / back-office), ou déjà géré côté back-office ?

### Décisions S6  *(validées 2026-07-10)*
- **P20 → OK** : **zéro drop** dans ce lot (drops = R4 endgame).
- **P21 → OK** : backfill `org → (accountType, org.level)`, `user → (particulier, user.kycLevel)`.
- **P22 → seed via seeder** : la grille `(segment, level) → limites` (marchand/entreprise) est seedée
  (valeurs à fournir).
## S7 — Découpage tracer-bullets + tests  *(proposition, à valider)*

### Raffinement à trancher : statut party dans `getStanding`
`getStanding` renvoie le statut party (bloqué/actif). **User** : identity lit `user.status` en
direct (même contexte). **Org** : identity **ne peut pas** lire `org.status` (produit) → le statut
doit être **poussé sur le compte** par le produit. Deux options :
- **(a)** `getStanding` **branche par ownerType** : user → `user.status` live ; org → `account.status`
  (poussé par le produit). Pas de duplication côté user. *(reco)*
- **(b)** `account.status` (party) **pour tous**, poussé uniformément (identity pour user en
  in-context, produit pour org). Uniforme mais duplique `user.status`.

> NB : ce `account.status` est le **statut party (opérationnel)**, **distinct** du gel argent
> (`WalletStatus`) et du niveau. Il n'y a **pas** de statut *money* sur le compte (P3 reste caduque).

### Séquence tracer-bullets (chaque étape reste verte)
- **É0 — Fondation data** : migrations (`accounts` += segment/level ; `kyc_level` += segment ;
  `kyc_documents` += account_id) + **seeder** grille limites + backfill. *(tu lances)* — aucun code, vert.
- **É1 — Relocaliser `Account` → identity + split provisioning** : déplacer modèle + provisioning en
  identity ; `AccountProvisioningService` **ouvre le compte + émet `AccountOpened`** ; money **écoute**
  → crée le wallet. MAJ imports. Test : provisioning crée compte+wallet, suites vertes.
- **É2 — `AccountStandingService` + `AccountService` (identity)** : `getStanding` (segment/level/
  limites/partyStatus) + `setLevel` ; câbler KYC user → setLevel, statut party, produit org →
  AccountService. Tests unitaires standing (user/org, niveaux, caps `null`).
- **É3 — Refactor validation money** : `PartyValidator` par `accountId` (standing → party +
  WalletStatus + limites) ; `TransactionLimitValidationService` par `accountId` + limites injectées ;
  `AccountValidationService` garde l'auth. Tests unitaires validator (émetteur / dest. user / dest.
  marchand, limites, party bloqué, wallet gelé).
- **É4 — Câbler les 4 use cases** : `external_in/out/e2e/internal_move` passent `accountId`,
  `resolveWallet` sans user, `recipientLabel` depuis metadata ; use cases produit passent le label.
  Test : **caractérisation verte** (w2w, deposit, transfert, inter, checkout, internal_move_merchant) ;
  checkout marchand désormais validé via standing.
- **É5 — Nettoyage** : retirer la partie statut+wallet d'`AccountValidationService`, tout `wallet.user`,
  la fuite `WalletStatus` en identity. Tests verts.

### Tests à préserver / ajouter
- **Préserver (caractérisation)** : `wallet_to_wallet_flow`, `settlement_flow`, `transfert_inter_flow`,
  `inter_settlement_flow`, `checkout_flow`, `internal_move_merchant_flow`.
- **Ajouter** : `getStanding` (user/org, niveaux, caps `null`), `PartyValidator` account-centric
  (blocage party, gel wallet, limites par rôle), **limites de réception marchand** (marchand limité /
  entreprise illimité).

### Points à trancher pour clore S7 (et le brainstorming)
- **P23** — Statut party : option **(a)** branche par ownerType *(reco)* ou **(b)** `account.status`
  uniforme ?
- **P24** — La séquence É0→É5 (chaque étape verte, migrations d'abord lancées par toi) te convient-elle ?

### Décisions S7  *(validées 2026-07-10)*
- **P23 → (a)** ~~branche par ownerType~~ **RÉVISÉ → (b) push-sync uniforme** (2026-07-10, directive
  utilisateur « chaque couche pousse son état vers la feature à chaque modif pour la synchro »).
  Le compte porte **`party_status`** (synchronisé). **Chaque contexte propriétaire pousse** son
  statut sur le compte **à chaque changement** : identity (user) → `AccountService.setPartyStatus`
  sur tout changement de `user.status` ; produit (org) → idem sur `organisation.status` (produit→core
  par service). `getStanding` **ne lit que le compte** (source unique en lecture, aucune lecture
  cross-contexte, aucune branche par ownerType). Idem pour le **niveau** : identity pousse sur KYC,
  produit pousse sur KYB.
- **P24 → OK** : séquence **É0→É5** adoptée (migrations lancées par l'utilisateur d'abord, chaque
  étape verte).

---

## ✅ Brainstorming terminé
Plan complet S1→S7 arrêté. **Décision d'archi majeure** : `Account` migre **money → identity**
(variante β) ; il porte `{ segment, level, status(party) }` ; le **gel argent** reste `WalletStatus` ;
la **validation** reste orchestrée en money mais **account-centric** (lit `getStanding` par
`accountId`). **Prochaine action** : implémenter **É0** (migrations + seeder + backfill) — **sur feu
vert explicite**, et l'utilisateur lance les migrations.

---

## Journal d'implémentation

### É0 — Fondation data *(fichiers créés 2026-07-10, à exécuter par l'utilisateur)*
- `database/migrations/1783452576001_add_segment_and_level_to_accounts_table.ts` — `accounts` += `segment`/`level` + backfill (user→particulier/kyc_level ; org→accountType/level).
- `database/migrations/1783452576002_add_segment_to_kyc_level_table.ts` — `kyc_level` += `segment` + unique `(segment, level)` + backfill particulier.
- `database/migrations/1783452576003_add_account_id_to_kyc_documents_table.ts` — `kyc_documents` += `account_id` + backfill.
- `database/seeders/kyc_level_seeder.ts` — grille marchand/enterprise (⚠️ montants marchand PLACEHOLDER ; enterprise L2 = null illimité, L0 = bloqué).
- **À lancer** : `node ace migration:run` puis `node ace db:seed --files=./database/seeders/kyc_level_seeder.ts`.
- **DB-only** → suite verte inchangée (aucun code applicatif touché). Baseline avant É0 : 311 passed / 4 pré-existants.

### É1a — Relocalisation `Account` money→identity *(fait 2026-07-10)*
- Feature `account` déplacée `app/core/money/account/` → **`app/core/identity/account/`** (modèle + enums + repo + provisioning). Ancien module supprimé.
- Modèle `Account` enrichi : `segment` (`AccountSegment`: particulier|marchand|enterprise) + `level` (nullable) ; repo += `findByAccountId`.
- Imports repointés (register, create_organisation produit, provider, 4 tests) via `#core/money/account/` → `#core/identity/account/`. `register → provisioning` devient **in-context** (identity).
- Provisioning inchangé (crée compte+wallet atomiquement ; `WalletService` reste appelé = identity→money WARN transitoire, résorbé en É1b via event `AccountOpened`).
- Vérifs : suites ciblées **27 passed**, depcruise **0 ERROR**, lint clean.

### É1b — Provisioning event-driven (unidirectionnel money→identity) *(fait 2026-07-10)*
- **Décision révisée** (question utilisateur « c'est bidirectionnel non ? ») : **option 2** retenue —
  `identity` ne rappelle **jamais** `money`. Le provisioning devient piloté par event.
- **`AccountService` (identity)** remplace `AccountProvisioningService` : `openAccount(cmd, trx?)` crée
  le compte (idempotent, segment+niveau) ; **sans trx** il annonce lui-même, **avec trx** l'appelant
  appelle `announceOpened(account)` après commit. Ne crée PAS le wallet.
- **`AccountOpened` (event identity)** → **money écoute** (`CreateWalletOnAccountOpened`) →
  `WalletService.createForAccount` (idempotent). Dispatch awaité = wallet créé de façon synchrone.
- `register` (identity) : compte créé DANS la trx (user+compte atomiques) → `announceOpened` après
  commit. `create_organisation` (produit) : `openAccount(trx)` (produit→core par service) →
  `announceOpened` après commit.
- Ancien `AccountProvisioningService` supprimé ; 4 tests migrés vers `AccountService.openAccount`.
- **Dépendances** : `money→identity` (event + lecture `Account` shared-kernel), `produit→core`
  (service) ; **aucun `identity→money`**, aucun `core→produit`. depcruise **0 ERROR**.
- **Atomicité** : compte↔wallet désormais *éventuelle* (wallet post-commit via event awaité, fiable) ;
  `createForAccount` idempotent = self-heal à la réémission. Filet lazy explicite = suivi si besoin.
- Vérifs : suites ciblées **27 passed**, full **311 passed / 4 pré-existants**, depcruise 0 ERROR, lint clean.

### É2a — Fondation lecture du standing *(fait 2026-07-10)*
- **Migration** `…576004` : `accounts += status` (`active`/`blocked`, défaut active) + backfill depuis
  `user.status` / `organisation.status`. *(lancée par l'utilisateur)*
- **`AccountStatus`** enum (identity) + `Account.status` (modèle).
- **`KycLevel`** += `segment` ; plafonds passés `number | null` (`null` = illimité) ; repo
  += `findBySegmentAndLevel`.
- **Read port `AccountStandingService.getStanding(accountId)`** → `{ segment, level, status, limits }`
  (Result minimal), lit **le compte seul** ; limites via un **service kyc**, pas le repo.
- **Décision naming (utilisateur)** : `status` (pas `party_status`) — aucune collision sur `accounts`
  (le gel argent = `WalletStatus`, sur `wallets`).
- **`AccountService`** += `setLevel` / `setStatus` (écriture push-sync).
- **Exceptions métier dédiées** (durcissement #1) : `AccountNotFoundException`,
  `AccountLimitsNotConfiguredException` (messages custom user-friendly).
- **R6 (backlog)** : « consommation cross-feature par repository » signalée répandue → durcissement
  dédié. **Spot-fix** de ce cas : `KycLevelDirectoryService` (service kyc) expose
  `getLimits(segment, level) → KycLevelLimitsResult` ; `AccountStandingService` le consomme (plus le repo).
- **Cache** (donnée de référence, lue à chaque validation) : `KycLevelCache` (port) +
  `KycLevelCacheService` (`@adonisjs/cache`, store `cache` = Redis db 2, TTL 24h, `invalidate`),
  mirror de `CountryCache`. Le directory service passe par le cache (load-through). db 2 = éphémère,
  distincte de la db 4 fintech-critique.
- **Test** `account_standing_flow.spec` (5 cas) : particulier, marchand limité, enterprise illimité
  (`null`), sync setLevel/setStatus, 404. `cache.clear()` en setup (cache non transactionnel).
- Vérifs : **5 passed** (ciblé), depcruise **0 ERROR**, lint clean, JSDoc explicite.

### É2b — Push-sync (propriétaire → compte) *(fait 2026-07-10)*
- **Principe (directive utilisateur)** : chaque contexte pousse son état vers le compte à chaque
  changement → le compte est la **source unique en lecture** (getStanding, aucune branche ownerType).
- **Niveau** : listener `SyncAccountLevelOnKycUpdated` (account) sur `UserKycStatusUpdated` →
  `AccountService.setLevel`. Fix : `update_user_kyc_status` dispatche désormais le **niveau
  résultant** (`user.kycLevel`), pas le param — sinon un VERIFIED sans niveau explicite n'aurait rien
  synchronisé.
- **Statut (admin)** : listener `SyncAccountStatusOnUserStateChanged` sur `UserStateChanged` →
  `setStatus` (map `UserStatus.ACTIVE→ACTIVE`, sinon `BLOCKED`).
- **Statut (brute-force)** : les guards `PinAttemptGuard` / `UserOtpAttemptGuard` poussent en
  **direct** `AccountService.setStatus(BLOCKED)` sur auto-block (pas via l'event `UserStateChanged`,
  dont le listener notif enverrait à tort « bloqué par l'administration »). Décision validée :
  **auth-block gèle l'argent**. Best-effort (n'interrompt pas le blocage auth).
- **Naming** : `account.status` (pas `party_status`) — pas de collision sur `accounts` (gel argent =
  `WalletStatus`, sur `wallets`).
- **Tests** : `account_sync_flow.spec` (3 cas e2e via le vrai chemin d'events : block/unblock admin,
  KYC verified→niveau) + assertion account-sync dans `pin_attempt_guard.spec` (unit).
- Vérifs : suites ciblées **19 + 3 passed**, full **319 passed / 4 pré-existants**, depcruise 0 ERROR,
  lint clean, JSDoc explicite.

### É3 — Validation money account-centric *(fait 2026-07-10)*
- **`PartyValidator` (money)** refondu en orchestrateur par `accountId` : lit `getStanding` (identity)
  → **statut party** actif (sinon `AccountBlockedException`), **wallet actif** (sinon
  `WalletInactiveException`), puis **limites**. Ne dépend plus de `User` ni de `wallet.user`. Injecte
  `AccountStandingService` + `WalletService` + `TransactionLimitValidationService`.
- **`TransactionLimitValidationService` (money)** refondu : entrée `{ accountId, amount, type,
  direction, limits, walletBalance }` — limites **injectées** (plus de `user.keyLevel`), volume par
  `accountId`, plafonds `null` = **illimité** (contrôle sauté).
- **Exception money** `AccountBlockedException` (statut party bloqué ≠ gel wallet).
- **5 call-sites** (external_in user-branch / external_out / e2e / internal_move ×2) passent
  `accountId` au lieu de `user`. external_in **marchand** garde `wallet.status` (enforcement limites
  marchand par standing = suivi, hors lot). La branche user d'external_in/internal_move ne lit plus
  `wallet.user`.
- **Fixtures** : `swapGuards` neutralise désormais `PartyValidator` (permissif) — les tests consumer
  n'ont pas de compte/standing seedé. checkout_flow (pas de swapGuards) reste vert via la branche
  marchand `wallet.status`.
- **Tests** : `party_validator.spec` (unit, 4 cas : délégation limites, party bloqué, wallet gelé,
  propagation exception limites).
- **Dette → É5** : `AccountValidationService.validateAccount` devient **dead code** (plus aucun
  appelant) → à retirer avec la fuite `WalletStatus` (identity→money) en É5.
- Vérifs : ciblé **32 + 4 passed**, full **323 passed / 4 pré-existants**, depcruise 0 ERROR, lint clean.

### É5 — Nettoyage *(fait 2026-07-10)*
- **`AccountValidationService.validateAccount` supprimé** (dead code depuis É3 : 0 appelant, la
  validation statut+wallet vit désormais dans `PartyValidator` account-centric).
- **Fuite `identity → money` retirée** : `AccountValidationService` n'importe plus `WalletStatus` /
  `WalletInactiveException` (conformité β). Il ne garde que l'**auth** (device trust + PIN).
- Vérifs : full **323 passed / 4 pré-existants**, depcruise 0 ERROR, lint clean.

### É4 — Label (recipientLabel / nom org) — REPORTÉ *(décision 2026-07-10)*
Peu de valeur autonome maintenant : le **producteur** du label marchand (nom d'org via QR) est la
feature **aiglesend→marchand**, en pause ; et `wallet.load('user')` reste (record `usersId` jusqu'au
R4). **Replié dans la reprise de la feature marchand**, là où il délivre. Le seam est prêt (les use
cases passent déjà `accountId` ; les descriptions liront un `recipientLabel` de `metadata`).

---

## ✅ Refactor account-centric — IMPLÉMENTÉ (É0–É3, É5) ; É4 replié dans la feature marchand
Validation money **account-centric** en place : `PartyValidator.validate({ accountId })` lit le
**standing** (identity, source unique) → statut party + gel wallet + limites ; le compte (identity)
porte `segment`/`level`/`status`, synchronisés par **push** depuis les propriétaires. Provisioning
**unidirectionnel** `money → identity` (event `AccountOpened`). Tout vert (baseline 4 pré-existants),
depcruise 0 ERROR à chaque étape.

**Suites (backlog)** : R4 (drop `user_id`/`users_uid` + relation `belongsTo(User)`) ; R6 (repo
cross-feature) ; enforcement **limites de réception marchand** via standing ; É4 label + reprise
**aiglesend→marchand**.
