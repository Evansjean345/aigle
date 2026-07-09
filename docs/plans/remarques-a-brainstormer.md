---
type: backlog
description: Remarques / observations à brainstormer et corriger plus tard (ne pas traiter à la volée)
derniere_maj: 2026-07-09
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
| R1 | 🔴 Critique | à brainstormer | Permissions du RBAC **team** créées en CRUD par l'admin au lieu d'être **déclarées en code** par chaque feature — faille de sécurité (contrôle d'accès orphelin / privilege escalation) |
| R2 | 🟠 Majeur | à brainstormer | Notifications **push** non scopées par app : `expo_push_channel.getTrustedDevices(recipientId)` envoie à TOUS les appareils de confiance (aiglesend + business). Une notif aiglesend pousse aussi vers l'app business |
| R3 | 🟢 Feature | **décidé — à implémenter** | Flux de **transfert de propriété** d'une organisation (owner unique). Le verrou (owner non attribuable) est en place ; il manque l'endpoint de transmission explicite |
| R4 | 🟠 Majeur | à faire (endgame D8) | Supprimer `user_id`/`users_uid` de `wallets` & `transactions` une fois le core argent **entièrement** account-centrique (`account_id` suffit). Aujourd'hui encore très référencés → nettoyage différé après la migration complète des lookups |

---

## Remarques

### R4 — Retirer user_id/users_uid de wallets & transactions (fin de D8)
- **Niveau** : 🟠 Majeur (nettoyage de dette sur des tables argent — rayon d'impact large)
- **Date** : 2026-07-09
- **Contexte** : la fondation D8 (sous-lot 4) rend le core argent **account-centrique** (`account_id` sur wallets et transactions ; `account_id == usersUid` pour un user). À terme, `user_id`/`users_uid` sur `wallets` et `transactions` deviennent **redondants** — le propriétaire d'un compte vit dans `core/money/account` (owner_type + owner_ref).
- **Pourquoi différé** : ces colonnes sont **encore très utilisées** — relation `belongsTo(User)` + scope `search` sur `transactions`, `WalletService.getByUserId` / `resolveRecipient` / `updateWalletStatus`, et de nombreux use cases (`settle_deposit` etc.). La suppression n'est possible qu'**après** avoir migré TOUS ces lookups vers `account_id` (deposit/transfert/w2w/inter + admin). Retirer les colonnes/FK d'une table argent est une opération à haut risque.
- **Séquence cible** : (1) finir de rendre external_in/settle/transfert/w2w account-centriques ; (2) migrer les lookups résiduels `getByUserId` → `getByAccountId` ; (3) remplacer la relation/scope `user` par une résolution via `account` ; (4) migration de suppression de colonnes (après stabilisation du sous-lot 4 + mass-paiement).
- **Impact** : simplifie le modèle argent, supprime la double clé user/account, aligne sur le pivot account. **À ne PAS faire tant que des lookups user subsistent.**
- **Statut** : à faire (endgame D8), après sous-lot 4 & mass-paiement

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
