---
type: backlog
description: Remarques / observations à brainstormer et corriger plus tard (ne pas traiter à la volée)
derniere_maj: 2026-08-01
---

# Remarques à brainstormer

Backlog des observations soulevées en cours de route mais **volontairement différées** : chacune
mérite un vrai passage par le skill brainstorming (design + décisions) avant correction. Ne pas les
corriger à la volée.

## Niveaux de criticité

Chaque remarque porte un **niveau** — il pilote la priorité de brainstorming/correction :

| Niveau | Sens | Priorité |
|--------|------|----------|
| 🔴 **Critique** | Faille de sécurité, intégrité financière, perte/corruption de données, contournement de contrôle d'accès. **Bloquant avant prod.** | Brainstormer en priorité |
| 🟠 **Majeur** | Défaut d'architecture à fort impact (couplage structurel, invariant manquant), bug fonctionnel important, dette qui s'aggrave. | À planifier |
| 🟡 **Mineur** | Incohérence, dette localisée, amélioration de lisibilité/maintenabilité sans risque. | Opportuniste |
| 🔵 **Idée** | Piste d'amélioration / évolution produit, non urgent. | Quand pertinent |

## Format

Chaque remarque : un niveau, un titre, la date, le contexte (où/quoi), pourquoi c'est différé, l'impact.

| # | Niveau | Statut | Remarque |
|---|--------|--------|----------|
| R11 | 🔴 Critique | à brainstormer | **Les tests s'exécutent sur la base de production** : `config/database.ts` n'a qu'une connexion, alimentée par `.env`, et il n'existe pas de `.env.test`. Plusieurs suites vident des tables (`Permission.query().delete()`) en comptant sur le rollback |
| R1 | 🔴 Critique | à brainstormer | Permissions du RBAC **team** créées en CRUD par l'admin au lieu d'être **déclarées en code** par chaque feature — faille de sécurité (contrôle d'accès orphelin / privilege escalation) |
| R2 | 🟠 Majeur | ✅ FAIT (2026-07-11) | Notifications **push** scopées par app. Infra : `Notification.targetApp?` + `expo_push_channel.send` → `getTrustedDevices(recipientId, app)`. **Scopés `aiglesend`** : dépôt, transfert, w2w (transfert émis/reçu + payeur pay-merchant), KYC (soumis/traité). **Scopé `aiglebusiness`** : encaissement marchand (checkout + pay-merchant reçu). **Volontairement all-apps** (sécurité account-wide, le porteur doit être averti partout) : `user_state_changed` (blocage/activation compte), `wallet_status_changed` (gel wallet). `new_device` déjà scopé (via `getActiveUserDevices(userId, app)`) |
| R3 | 🟢 Feature | **décidé — à implémenter** | Flux de **transfert de propriété** d'une organisation (owner unique). Le verrou (owner non attribuable) est en place ; il manque l'endpoint de transmission explicite |
| R4 | 🟠 Majeur | à faire (endgame D8) | Supprimer `user_id`/`users_uid` de `wallets` & `transactions` une fois le core argent **entièrement** account-centrique (`account_id` suffit). Aujourd'hui encore très référencés → nettoyage différé après la migration complète des lookups |
| R5 | 🟠 Majeur | **décidé (design) — à implémenter** | **Palier/niveau + documents de vérification portés par le COMPTE** (pas user/org) : `account` porte son niveau → limites/volume/blocages-argent par `account_id` ; docs KYC/KYB ancrés `account_id`. Unifie KYC (user) et KYB (org) sous `account → niveau → limites`. Auth (PIN/OTP/brute-force) reste par user. ⚠️ KYB (sous-lot 2) à construire account-anchored dès le départ |
| R6 | 🟠 Majeur | à brainstormer | **Consommation cross-feature par REPOSITORY** au lieu du service : des services/use cases injectent directement le `Repository` d'une **autre feature** (ex. `AccountStandingService` → `KycLevelRepository`). Viole « feature consomme feature par son **service** » (généralisation de `produit-consomme-core-par-service`). Répandu dans le code → passe de durcissement dédiée |
| R7 | 🟡 Mineur | ✅ FAIT (2026-07-11) | Notif marchand du **paiement interne** (`pay-merchant`) : listener produit `OnMerchantPaymentReceivedNotification` (event `WalletToWalletTransactionCompleted` type=`merchant` → owner de l'org). **+** le payeur est désormais notifié (« Paiement effectué ») via le listener consumer (avant : rien pour lui). 5 tests verts |
| R9 | 🟡 Mineur | ✅ FAIT (2026-07-11) | **`balanceAfter` jamais peuplé** sur le modèle `Transaction` (notifs P2P affichaient « undefined »). Corrigé : le solde est désormais porté par l'event `WalletToWalletTransactionCompleted` (`senderBalanceAfter`/`recipientBalanceAfter` depuis `debited.balance`/`credited.balance` d'`internal_move`) ; les 3 notifs w2w (transfert émis/reçu, paiement marchand payeur) l'affichent |
| R10 | 🟡 Mineur | à faire (plus tard) | **Tests fonctionnels de l'API transactions business** manquants (`GET /business/organisations/:organisationId/transactions` + `/:reference`). Couvrir : liste + détail scopés au compte, 403 sans `transactions:view`, 404 cross-account, propriétaire marchand voit ses encaissements. Endpoint livré & documenté (swagger), tests différés à la demande de l'utilisateur |
| R8 | 🟡 Mineur | décidé (direction) — à implémenter | **Pas de montant (`amount_step`) porté par la tarification du catalogue** (SPM), pas hardcodé côté mobile. Les opérateurs externes (mobile money) imposent des montants **multiples de 5** ; les mouvements internes aigle (wallet-to-wallet, marchand) **non**. À exposer dans `payment-options` comme `minAmount`/`fees`, le mobile valide via `provider.amountStep` |

---

### R11 — Les tests s'exécutent sur la base de production
- **Niveau** : 🔴 Critique (perte de données possible sur une base de production)
- **Date** : 2026-08-01
- **Contexte** : relevé pendant le chantier RBAC (lot L3). `config/database.ts` définit une unique
  connexion `mysql` alimentée par `.env` ; `bin/test.ts` pose `NODE_ENV = 'test'` mais cela ne change
  pas la connexion, et aucun `.env.test` n'existe. La base pointée par `.env` est celle de
  **production** (confirmé le 2026-07-31).
- **Observation** : plusieurs suites fonctionnelles vident des tables avant chaque cas —
  `Permission.query().delete()` dans `tests/functional/team/permissions_sync.spec.ts` et
  `permissions_check.spec.ts` — en comptant sur `db.beginGlobalTransaction()` pour restaurer. La
  convention est antérieure au chantier (`organisations_admin.spec.ts` et d'autres l'appliquent),
  mais elle vise désormais aussi la table du contrôle d'accès.
- **Pourquoi ça tient aujourd'hui** : le rollback fonctionne. Preuve observée le 2026-08-01 — les 38
  slugs hors catalogue ont survécu à des dizaines d'exécutions de tests qui vident la table.
- **Pourquoi c'est critique quand même** : la marge tient à un rollback. Un test qui plante entre le
  `delete` et le rollback, une connexion coupée, ou un `SET FOREIGN_KEY_CHECKS = 0` laissé en place,
  et la table part. Les suites posent d'ailleurs ce `FOREIGN_KEY_CHECKS = 0` à chaque cas.
- **Piste** : un `.env.test` dédié, chargé par `bin/test.ts`, pointant une base jetable ;
  éventuellement un garde-fou refusant de démarrer la suite si la base cible est celle de `.env`.
- **Statut** : à brainstormer (chantier à part, hors RBAC — décidé le 2026-08-01).

### R6 — Consommation cross-feature par repository (au lieu du service)
- **Niveau** : 🟠 Majeur (couplage structurel inter-feature ; érode l'extractibilité)
- **Date** : 2026-07-10
- **Contexte** : une feature qui a besoin de données d'une **autre feature** injecte directement son
  `Repository` (port de persistance) plutôt que de passer par un **service applicatif** de cette
  feature. Cas relevé pendant le refactor account-centric : `AccountStandingService`
  (`identity/account`) injecte `KycLevelRepository` (`identity/kyc`) pour lire la grille de limites.
  L'utilisateur signale que le **motif est répandu** dans le code (pas un cas isolé).
- **Pourquoi c'est un anti-pattern** : le repository est un **détail interne** d'une feature (sa
  persistance). Le consommer depuis l'extérieur couple les deux features à la **forme de stockage**,
  court-circuite les invariants/projections que le service de la feature propriétaire garantit, et
  casse l'extractibilité (on ne peut plus extraire la feature sans traîner ses consommateurs). C'est
  la **généralisation** de la règle depcruise `produit-consomme-core-par-service` (produit → core par
  service), qui devrait valoir **feature → feature** en général — mais n'est aujourd'hui **pas
  outillée** pour l'inter-feature **intra-contexte** (money/identity/catalog internes).
- **Pourquoi différé** : correction transverse (nombreux call-sites) ; nécessite de décider, feature
  par feature, **quel service** exposer (contrat minimal, `Result`) et parfois **où doit vivre la
  donnée** (ex. la grille `(segment, level) → limites` est-elle un concern `kyc` ou `account` ?
  l'account-centric plaide pour la déplacer côté `account`). Pré-empter localement risquerait
  d'introduire un service jetable.
- **Pistes (à brainstormer, pas à figer)** :
  1. Généraliser `produit-consomme-core-par-service` en une règle depcruise **feature → feature**
     (interdire l'import d'un `domain/interfaces/*repository` / `domain/models` d'une **autre**
     feature, même intra-contexte) — WARN d'abord, le temps de résorber.
  2. Chaque feature expose un **service d'accès en lecture** (façon `UserDirectoryService`) renvoyant
     un `Result` minimal ; les consommateurs passent par lui.
  3. Repositionner les données mal placées (ex. **catalogue des niveaux/limites** → feature
     `account`, ce qui **supprimerait** la dépendance `account → kyc` du cas relevé).
- **Cas concret à corriger lors du durcissement** : `AccountStandingService` → passer par un service
  `kyc` (ou déplacer le catalogue de niveaux vers `account`), au lieu de `KycLevelRepository`.
- **Statut** : à brainstormer (durcissement dédié). En attendant, le cas `AccountStandingService` est
  **laissé tel quel** (dépendance repo cross-feature intra-`identity`), tracé ici.

### R5 — Palier/niveau porté par le compte (unification KYC/KYB)
- **Niveau** : 🟠 Majeur (transverse identity + money + business ; money-critical)
- **Date** : 2026-07-10
- **Décision (design acté avec l'utilisateur)** :
  - Le **niveau/palier est une propriété du COMPTE** (`account`), pas du user. `organisation <-> user => account`, le compte porte son niveau. **Pas** de dimension `app` explicite : l'app est **impliquée par `ownerType`** (compte user → aiglesend / compte org → aiglebusiness).
  - Résolution **unifiée** : `account → niveau → limites`. Supprime la branche « ce compte est-il un user (→ KYC) ou une org (→ KYB) ? » dans la validation des limites.
  - **Séparation nette** — concerns **ARGENT → `account_id`** : limites (`transaction_limit_validation_service`), volume (`persist_user_transactions_volume`), compteurs sécurité argent (`reset_security_counters_on_success`, `handle_transaction_failure`). Concerns **AUTH → restent `user_id`** : blocage PIN (`auth:pin:block:${userId}`), blocage OTP (`auth:user:otp:block:${userId}`), brute-force login (`security_alert:failed_auth`) — **un compte marchand ne s'authentifie pas** ; c'est son propriétaire (user) qui saisit PIN/OTP.
- **État actuel** : limites sur table `KycLevel` (single/daily/monthly/balanceLimit), pointée par `User.kycLevel`. L'org a `OrganisationLevel` (L0/L1/L2) **sans** table de limites. Deux mondes à unifier sur `account`.
- **Documents de vérification rattachés au COMPTE** (extension actée) : les documents KYC (aujourd'hui `kyc_documents.user_id`) et KYB (à venir) s'ancrent au **compte**, pas au user/org. La *nature* de la vérification dépend de `ownerType` (compte user → identité KYC recto/verso/selfie ; compte org → RCCM/DFE KYB). « Rattaché à » ≠ « soumis par » : la soumission reste une action utilisateur (un user soumet son identité, un owner le RCCM), mais le doc est ancré `account_id`.
  - **KYC** : migrer `kyc_documents.user_id` → `account_id` (backward-compat en valeur : `account_id == usersUid`).
  - **KYB** : **pas encore construit** (sous-lot 2) → le concevoir **account-anchored dès le départ** (`account_id`), pour éviter une future migration. ⚠️ à retenir au moment du sous-lot 2 KYB.
  - **⚠️ Le KYB VIT DANS LE CORE, pas dans le produit business** (imposé par l'invariant `core-ne-depend-pas-du-produit`) : le palier du compte (core/money) dérive de la vérification → si le KYB était dans le produit, core→produit = **violation**. La feature `core/identity/kyc` passe donc de « KYC identité » à **« vérification de compte »** : elle gère les documents d'identité (compte user) ET entreprise/RCCM/DFE (compte org), distingués par `ownerType`/type de doc. Elle **réutilise** soumission + revue admin (`process_kyc_document`) + paliers (`kyc_level`) + events. **Le core ne connaît JAMAIS le modèle `Organisation`** : il travaille sur `account_id` + `ownerType` + métadonnées de doc (RCCM/DFE = champs, pas une relation business). Le produit business garde une **présentation mince** (soumission owner) qui appelle le **service core de vérification** (produit→core par service).
- **Esquisse** : ajouter le niveau (+ résolution des limites) au compte (`accounts.tier` ou table `account_tier` reliant niveau→limites, réutilisable pour user KYC & org KYB) ; une **vérification par compte** (documents + status, type selon ownerType) ; migrer les lookups argent `userId` → `accountId` ; définir les limites d'un compte marchand (KYB → paliers business).
- **Pourquoi différé** : transverse (identity/money/business), money-critical, et **le checkout MVP n'en a pas besoin** (un marchand qui *reçoit* n'a pas de limite bloquante ; les gardes actuelles sautent proprement le marchand). Naturellement couplé à [[R4]] (endgame D8 account-centrique).
- **Statut** : décidé (design) — à implémenter après le sous-lot 4 (checkout) & mass-paiement, groupé avec R4.

## Remarques

### R4 — Retirer user_id/users_uid de wallets & transactions (fin de D8)
- **Niveau** : 🟠 Majeur (nettoyage de dette sur des tables argent — rayon d'impact large)
- **Date** : 2026-07-09
- **Contexte** : la fondation D8 (sous-lot 4) rend le core argent **account-centrique** (`account_id` sur wallets et transactions ; `account_id == usersUid` pour un user). À terme, `user_id`/`users_uid` sur `wallets` et `transactions` deviennent **redondants** — le propriétaire d'un compte vit dans `core/money/account` (owner_type + owner_ref).
- **Pourquoi différé** : ces colonnes sont **encore très utilisées** — relation `belongsTo(User)` + scope `search` sur `transactions`, `WalletService.getByUserId` / `resolveRecipient` / `updateWalletStatus`, et de nombreux use cases (`settle_deposit` etc.). La suppression n'est possible qu'**après** avoir migré TOUS ces lookups vers `account_id` (deposit/transfert/w2w/inter + admin). Retirer les colonnes/FK d'une table argent est une opération à haut risque.
- **Séquence cible** : ~~(1) finir de rendre external_in/settle/transfert/w2w account-centriques~~ ✅ ; ~~(2) migrer les lookups résiduels `getByUserId` → `getByAccountId`~~ ✅ (clôture sous-lot 4, 2026-07-10) ; (3) remplacer la relation/scope `user` par une résolution via `account` ; (4) migration de suppression de colonnes (après stabilisation du sous-lot 4 + mass-paiement).
- **FAIT (2026-07-10, clôture sous-lot 4)** : les 7 lookups `getByUserId` hors `wallet_service` migrés vers `getByAccountId` (external_out/e2e/internal_move/settle_transfert/settle_inter_second/admin_refund/wallet_overview) ; `internal_move` rendu **account-aware sur la jambe destinataire** (user OU org marchand, null-safe : validation, description, paiement, event `WalletToWalletTransactionCompleted` avec flag `type: p2p|merchant` + `recipientAccountId`, listeners consumer self-filtrent). Reste **(3)+(4)** = endgame (relation `belongsTo(User)`/scope search + drop colonnes), toujours après mass-paiement.
- **FAIT (2026-07-11, étape 3 partielle — affichage titulaires)** : création d'**`AccountHolderResolver`** (`transactions/application/services`) — résolution des titulaires par `account_id` (chaîne wallet/transaction → account → owner) en 2 requêtes batch : comptes user via `UserDirectoryService.mapByIds` (invariant β `accountId == usersUid`), comptes org via alias payable. Basculés dessus : **ledgers admin+user** (`get_all_ledgers`, `get_user_ledgers` — preload `wallet.user` supprimé du repo), **transactions admin** (`get_all_transactions`, `get_user_transactions`, `get_transaction_details` — preload `user` supprimé du listing ; le wallet des détails est résolu par `walletService.getByAccountId`, ce qui rend l'**ajustement possible sur un wallet d'organisation**). Reste en (3) : `findByUidOrId` (preload user), **scope `search`** par nom (whereHas user), events `settle_*`/listeners (`usersUid`), signature `createTransaction`. Puis (4) drop des colonnes.
- **Impact** : simplifie le modèle argent, supprime la double clé user/account, aligne sur le pivot account. **À ne PAS faire tant que des lookups user subsistent.**
- **Périmètre chiffré (scan 2026-07-09)** :
  - `transaction.usersUid` lu à **~22 endroits** : les 4 `settle_*` (events `userId: transaction.usersUid`), listeners `persist_user_transactions_volume` + `reset_security_counters_on_success` (`sTx/rTx.usersUid`), `transaction_failure_handler`. Tous à migrer vers `account_id` (pour un consumer `account_id == usersUid` → équivalent).
  - `transaction.usersId` (numérique) : **lu nulle part** — ne sert QUE de FK à `belongsTo(User, foreignKey: 'usersId')` (admin `preload('user')` ×2 + scope `search`). Au R4 : basculer la relation sur `foreignKey: 'usersUid'` (ou résoudre via `account`), puis dropper `users_id`.
  - `createTransaction` : rendre `(accountId, usersUid)` la clé au lieu du `user` object ; **cesser** de poser `users_id` numérique. `createPayment` : retirer le param `user` (log-only, non persisté — le modèle Payment n'a AUCUNE colonne user).
  - 5 appelants de `createTransaction` (external_in/out/e2e/internal_move×2) à passer en `(wallet.accountId, wallet.userId)`.
- **Statut** : à faire (endgame D8), après sous-lot 4 & mass-paiement — décidé de NE PAS le faire en cours de sous-lot 4 (garder la transition account_id primaire + users_uid compat)

## Remarques

### R3 — Transfert de propriété d'une organisation (à implémenter)
- **Niveau** : 🟢 Feature (le garde-fou de sécurité, lui, est **déjà** en place — cf. commit owner-lock)
- **Date** : 2026-07-09
- **Contexte** : modèle adopté = **propriétaire unique + transfert explicite**. Le rôle système OWNER est déjà verrouillé (`SystemRoleNotAssignableException` sur invite/change-role ; owner non retirable/rétrogradable). Reste à construire le **flux de transmission**.
- **Décisions prises** (validées avec l'utilisateur, à ne pas re-brainstormer) :
  1. **Cible** : seul un **membre ACTIF existant** de l'organisation peut recevoir la propriété.
  2. **Confirmation** : **OTP du owner actuel** (2e facteur SMS, cohérent avec le flux membership).
  3. **Ex-owner** : reçoit un **rôle métier au choix** (précisé dans la requête de transfert) — il reste membre actif avec des droits normaux.
- **Esquisse d'implémentation** :
  - Endpoint `POST /organisations/{id}/transfer-ownership` (réservé au owner) : body `{ new_owner_member_id, previous_owner_role_id, otp }`.
  - Use case : valide que l'appelant est owner, que la cible est un membre ACTIF de l'org, que `previous_owner_role_id` est un rôle **non système** de l'org ; vérifie l'OTP ; **échange** les rôles de façon atomique (cible → rôle OWNER, ancien owner → `previous_owner_role_id`).
  - Émettre l'OTP en amont (endpoint de demande, ou réutiliser un template dédié `OwnershipTransferOtpTemplate`).
  - Doc business.yaml + tests (transfert nominal, cible non membre/non active, rôle système en `previous_owner_role_id`, OTP invalide, appelant non owner).
- **Statut** : décidé — à implémenter (plus tard)

### R2 — Notifications push non scopées par app (général)

### R2 — Notifications push non scopées par app (général)
- **Niveau** : 🟠 Majeur (mauvais routage des notifications entre apps)
- **Date** : 2026-07-09
- **Contexte** : `app/core/notifications/infrastructure/channels/expo_push_notification_channel_impl.ts` → `deviceService.getTrustedDevices(recipientId)` (sans app) ; modèle `Notification` (`recipientId`, title, message) — pas de dimension app.
- **Observation** : le canal push récupère **tous** les appareils de confiance du user (toutes apps). Une notification déclenchée dans un contexte aiglesend (dépôt, transfert…) est donc poussée **aussi** vers l'app aiglebusiness du même user (et inversement). Le cas **nouvel appareil** a été corrigé ponctuellement (event `NewDeviceDetected` porte l'app, listener scopé) ; mais le canal push générique reste non scopé.
- **Pourquoi différé** : scoper TOUTES les notifications par app = ajouter une dimension `app` au modèle `Notification` + à chaque émetteur/listener (dépôt, transfert, sécurité, KYC, wallet…) → refactor transverse du système de notifications. Design à part entière.
- **Impact pressenti** : moyen-fort (UX : notifications qui arrivent sur la mauvaise app ; pas une faille mais un mauvais routage).
- **Statut** : à brainstormer

### R1 — Permissions team CRUD par l'admin au lieu d'être déclarées en code
- **Niveau** : 🔴 Critique (sécurité — contrôle d'accès back-office)
- **Date** : 2026-07-09
- **Contexte** : RBAC back-office `app/core/team/` — `application/use_cases/permissions/{create,update,delete}_permission_use_case`, `presentation/controllers/permission_management_controller.ts`, validators `permission_validator.ts`, table `permissions` (migration `create_roles_permissions_tables`).
- **Observation** : les permissions du back-office sont **CRUD à l'exécution par l'admin** (créer/modifier/supprimer une permission via l'API). Or une permission est un **point d'ancrage de code** : elle n'a de sens que si une feature la vérifie (`can('x')`). Elles devraient donc être **déclarées en code**, chaque feature **émettant ses propres permissions** (catalogue figé), l'admin ne composant que des **rôles** à partir de ce catalogue.
- **Faille de sécurité** :
  - Un admin peut **créer une permission fantôme** (aucun endpoint ne la vérifie → faux sentiment de contrôle) ou **supprimer/renommer** une permission réellement utilisée → un contrôle d'accès en code se retrouve **sans permission correspondante** (gate qui échoue ouvert ou ferme selon l'implémentation).
  - **Dérive silencieuse** entre le code (`can('kyc:approve')`) et la table (slug modifié) → contrôles contournables ou cassés, non détectables statiquement.
  - Surface d'attaque : la gestion des permissions devient un vecteur de **privilege escalation** (forger un slug attendu ailleurs).
- **Le bon pattern existe déjà côté business** : `app/products/aiglebusiness/membership/domain/permissions.config.ts` = catalogue **en code** (`BUSINESS_PERMISSIONS`, `sensitive`, `isValidPermissionSlug`), l'org ne compose que des **rôles**. Cf. [[bounded-contexts-core]]. Le RBAC team fait l'**inverse** → incohérence + faille.
- **Piste (à brainstormer, pas à figer)** : catalogue de permissions team **en code** (chaque feature/back-office déclare ses slugs, comme le business) ; retirer le CRUD de permissions ; garder le CRUD de **rôles** (composés depuis le catalogue) ; migration : seeder/valider les permissions existantes contre le catalogue, gérer les slugs orphelins.
- **Pourquoi différé** : touche le RBAC back-office **en production** (rôles/permissions admin existants) → nécessite un design de migration (compat, seed, slugs orphelins) + validation ; hors du fil en cours (auth multi-app / Lot D).
- **Impact pressenti** : **fort** (sécurité : contrôle d'accès back-office ; cohérence d'architecture RBAC code-first).
- **Statut** : à brainstormer

<!-- Modèle pour une nouvelle remarque :

### R<n> — <titre court>
- **Niveau** : 🔴 Critique | 🟠 Majeur | 🟡 Mineur | 🔵 Idée  (+ courte justification)
- **Date** : YYYY-MM-DD
- **Contexte** : <où c'est apparu, fichiers/zone concernés>
- **Observation** : <ce qui a été remarqué>
- **Pourquoi différé** : <raison de ne pas traiter maintenant>
- **Impact pressenti** : <faible / moyen / fort — et sur quoi>
- **Statut** : à brainstormer

Puis ajouter la ligne dans la table récap en tête (# | Niveau | Statut | Remarque).
-->

### R7 — Notification marchand absente pour le paiement interne (pay-merchant)
- **Niveau** : 🟡 Mineur (feature de notif manquante, pas un défaut d'intégrité)
- **Date** : 2026-07-10
- **Contexte** : le listener `OnCheckoutReceivedNotification` (notif « paiement reçu » au propriétaire
  de l'org) écoute `DepositTransactionCompleted` filtré `type='checkout'` (encaissement externe). Le
  nouveau **paiement marchand interne** (`pay-merchant`, feature aiglesend→marchand) émet
  `WalletToWalletTransactionCompleted` avec `type='merchant'` — **aucun listener** ne notifie donc le
  marchand pour un encaissement interne.
- **Piste** : un listener produit (aiglebusiness) sur `WalletToWalletTransactionCompleted`, filtre
  `type='merchant'`, résout `recipientAccountId` → org → owner → push (miroir de
  `OnCheckoutReceivedNotification`). Owner-only (MVP), cf. décision existante.
- **Statut** : à faire (petite feature) — grouper avec l'harmonisation des notifs d'encaissement.

### R10 — Tests fonctionnels de l'API transactions business (différés)
- **Niveau** : 🟡 Mineur (trou de couverture, pas un défaut d'intégrité — endpoint livré et fonctionnel)
- **Date** : 2026-07-11
- **Contexte** : exposition des transactions business (`business_transactions_controller` +
  `business_transactions_routes`, use cases core `get_account_transactions` /
  `get_account_transaction_details`, repo `getAllByAccountId` / `findByReferenceAndAccountId`).
  Endpoint **livré et documenté** dans `docs/swagger/business.yaml`. La compilation/les tests n'ont
  pas encore été relancés.
- **Comportements à couvrir** (fonctionnels HTTP, convention `tests/functional/business/`) :
  1. Un propriétaire (marchand) liste **ses** transactions → 200 + pagination.
  2. Détail par référence scopé au compte → 200 sur une réf de l'org.
  3. Référence appartenant à **un autre compte** → 404 (le filtre porte sur `account_id`).
  4. Membre **sans** `transactions:view` → 403 (`orgPermission`).
  5. Invariant `account_id == organisationId` (le marchand ne voit que ses encaissements).
- **À vérifier au passage** : `npx tsc --noEmit` propre sur les fichiers touchés + run
  `PORT=3399 node --enable-source-maps --import @poppinss/ts-exec bin/test.ts --files="business_transactions_flow"`.
- **Pourquoi différé** : reporté explicitement à la demande de l'utilisateur.
- **Statut** : à faire (plus tard). Lié à [[pre-prod-admin-tests]] (trous de couverture avant prod).

### R8 — Pas de montant (`amount_step`) porté par la tarification du catalogue
- **Niveau** : 🟡 Mineur (règle métier de saisie ; incohérence si hardcodée)
- **Date** : 2026-07-10
- **Contexte** : les **opérateurs externes** (mobile money) exigent des montants **multiples de 5**
  (dénominations), pour éviter les décalages d'arrondi. Les **mouvements internes aigle**
  (wallet-to-wallet, paiement marchand) n'ont **pas** cette contrainte. Un premier jet côté mobile
  hardcodait « multiple de 5 » puis distinguait `methodCode === 'wallet'` vs externe — **rejeté** :
  distinction fragile, valeur en dur, non pilotée par la donnée.
- **Direction (décidée avec l'utilisateur)** : le **pas de montant vit dans la tarification du
  catalogue**, à côté de `min_amount`/`fee_fixed`/`fee_percent` — donc sur la ligne **`ServiceProviderMethod`**
  (SPM), par `(serviceType × paymentMethod × providerFrom)`. Chaque tarif porte son `amount_step`
  (opérateurs externes = 5 ; wallet aigle = 1 = pas de contrainte).
- **Esquisse d'implémentation** :
  - **DB** : migration `service_provider_methods += amount_step` (int, défaut 1). Backfill / seed :
    lignes `mobile-money` (externe) → 5 ; lignes `wallet` (aigle) → 1.
  - **Modèle** : `ServiceProviderMethod.amountStep`.
  - **Catalogue** : `get_payment_options_by_service_type.use_case` ajoute `amountStep` à la projection
    provider (à côté de `minAmount`), exposé par `/mobile/services/payment-options/:serviceType`.
  - **Mobile** : `Provider` (type catalogue) += `amountStep` ; un helper `isAmountValidForProvider(amount,
    provider)` valide `amount % (provider.amountStep ?? 1) === 0`. Utilisé uniformément par les écrans
    montant (transfert/dépôt/inter). Pour un mouvement interne (provider aigle, step=1) ou sans catalogue
    (pay-merchant), **aucune contrainte** — la donnée porte la règle, plus de `methodCode !== 'wallet'`
    en dur. Message : « Le montant doit être un multiple de {step} F CFA ».
  - **Cohérence back** : idéalement, le core money **rejette** aussi un montant non conforme au pas de
    la ligne SPM (défense serveur, pas seulement UI).
- **Statut** : décidé (direction) — à implémenter plus tard (reporté sur demande utilisateur).
