# Revue de code — Audit d'activité (rapport d'amélioration)

Date : 2026-07-09. Périmètre : le système d'audit `activity:audit` (core `app/core/audit/` +
émetteurs business `app/products/aiglebusiness/shared/business_audit.ts` et core/aiglesend/admin).
Objectif : préparer le brainstorm « organisation & observabilité admin ».

## Verdict

Le socle est sain **structurellement** (event bus découplé `activity:audit` → `AuditListener`
persiste + `SecurityAlertDetector` analyse ; write non bloquant ; fallback ledger_log si la DB
d'audit tombe ; connexion DB `audit` isolée). **Mais** le **contrat d'audit est non typé et non
canonicalisé**, ce qui a produit de la **dérive** (casing/taxonomie), et deux promesses ne sont
pas tenues : la **détection de sécurité** ne couvre qu'un seul cas, et l'**observabilité admin**
est bridée (zéro index, enrichissement acteur cassé). À corriger **avant** de brancher plus
d'événements.

---

## 🔴 Critiques

### C1 — `SecurityAlertDetector` n'analyse presque rien
`app/core/audit/application/services/security_alert_detector.ts:45` : `if (event.eventCategory !== 'AUTH') return`,
puis `AUTH_FAIL_TO_METHOD` ne contient **que** `USER_OTP_FAILED` (l.9-11). Conséquences :
- Les échecs AUTH **business** (`BUSINESS_LOGIN_FAILED`, `BUSINESS_LOGIN_OTP_FAILED`) sont
  persistés mais **jamais analysés** (absents de la map).
- Le refus RBAC `PERMISSION_DENIED` (catégorie `AUTHORIZATION`) est **ignoré** — alors que
  l'enum `SecurityAlertType.PRIVILEGE_ESCALATION` existe et **n'est émis nulle part**.
- Le PIN faux aiglesend (`USER_OTP_FAILED` couvre l'OTP, pas le PIN) n'est pas compté.
→ La détection brute-force ne couvre en pratique que l'OTP aiglesend. **On croit auditer pour
la sécurité ; la boucle de détection est quasi vide.**

### C2 — Table `audit_logs` sans AUCUN index
`database/audit_migrations/*` : 0 `.index()`. Or l'admin filtre/trie sur `event_category`,
`event_action`, `actor_id`, `actor_type`, `target_type/target_id`, `result`, `created_at`, et
un `LIKE %term%` (`audit_log_repository_impl.ts:19-45`), le tout `orderBy created_at desc` +
`paginate`. Sur une table qui **croît sans borne**, chaque écran admin = **full scan**. C'est le
plus gros frein à l'observabilité annoncée. (Manque au minimum : index `created_at`, composites
`(event_category, created_at)`, `(actor_type, actor_id, created_at)`, `(target_type, target_id)`,
`result`.)

### C3 — Contrat d'audit non typé → dérive réelle
`AuditRecordInput` (`audit_record_input.ts`) est un type ouvert de `string` libres. Résultat
constaté sur le code existant :
- **`actorType` incohérent** : `'Admin'` (37) **et** `'admin'` (71), `'User'`/`'USER'`,
  `'System'`/`'SYSTEM'`/`'system'`. Or l'enrichissement admin teste `actorType === 'admin'`
  (`list_audit_logs_use_case.ts:45`) → **les 37 événements `'Admin'` ne sont jamais enrichis**.
- **`eventCategory` incohérent** : `ROLE` (6) vs `ROLES` (2), etc. — pas de taxonomie figée.
- **`actorId` incohérent** : aiglesend émet `String(user.id)` (id interne numérique), business
  émet `usersUid` (cuid public). **Le même utilisateur a deux identités d'acteur** → impossible
  de corréler son activité entre aiglesend et business.
→ Sans enum/constantes partagées, la dérive est structurelle et va empirer à mesure qu'on ajoute
des émetteurs.

---

## 🟠 Majeurs

### M1 — Enrichissement d'acteur limité aux admins
`list_audit_logs_use_case.ts:41-69` ne résout les noms que pour `actorType === 'admin'` (via le
modèle `Admin`, id numérique). Les événements **business/consumer** (`actorType 'User'`,
`actorId = usersUid`) s'affichent en **identifiant brut** côté admin — observabilité pauvre. En
plus le filtre `Number(actorId)` exclut d'office les cuid (donc même intention KO pour User).

### M2 — Audit dispersé entre couches (incohérence architecturale)
- Core/aiglesend : audit émis dans les **use cases** (succès + échec, ex.
  `verify_and_authenticate_user_account_use_case.ts`).
- Business : audit émis dans les **contrôleurs** (`*_controller.ts`) pour les mutations, et dans
  les **use cases** pour l'auth. Mélange présentation/application.
→ Deux styles = règles éparpillées, couverture des échecs asymétrique (les mutations business
n'ont le FAILURE que via le wrapper `auditDenials`, pas les autres échecs comme 404/409/422).

### M3 — `metadata` non requêtable
`channel`, `geoCountry`, `geoCity`, `isVpn`, `permission`… vivent dans la colonne JSON `metadata`.
Le repo ne filtre que sur des colonnes top-level → **impossible pour l'admin de filtrer par canal,
pays, VPN, permission**. Or ce sont des axes d'observabilité clés (accès off-hours, VPN, pays).

### M4 — Pas de durabilité garantie de l'audit
`emitBusinessAudit`/`emit('activity:audit')` sont **fire-and-forget** (`.catch(() => {})`, non
`await`). Si le process meurt entre l'émission et l'écriture (ou si l'event loop est saturé),
**l'entrée d'audit est perdue** sans trace. Pour une piste d'audit fintech (valeur légale), c'est
insuffisant : pas d'outbox/at-least-once. Le fallback `ledger_log` (`audit_listener.ts:13`) ne
couvre que l'échec DB **après** que le listener s'est exécuté, pas la perte de l'événement.

### M5 — `auditDenials` trop large
`business_audit.ts` : intercepte **tout** `status === 403`. Or côté invite, `InviteeKycNotVerified`
(403) est une validation métier, pas un refus RBAC — il sera loggé comme un « denial ». À
resserrer sur les vrais refus d'autorisation (permission / owner / rôle système) ou requalifier
l'action.

---

## 🟡 Mineurs / hygiène

- **Mn1** — Couverture des échecs incomplète côté business : seuls SUCCESS (mutations) + FAILURE
  RBAC/auth sont tracés ; 404/409/422 ne le sont pas (choix à assumer explicitement).
- **Mn2** — Pas de corrélation de bout en bout : `request_id` change à chaque requête ; aucun
  trace/session id pour suivre login→verify→action d'un même utilisateur.
- **Mn3** — Pas de stratégie de rétention/partitionnement → table non bornée (coût, RGPD/DPA :
  IP/UA = données perso, durée de conservation à définir).
- **Mn4** — `result` est un `string` libre (`'success'|'failed'|'pending'`) non contraint au modèle.
- **Mn5** — Recherche `LIKE %term%` non indexable (full-text/GIN absent).
- **Mn6** — `AuditRecordInput.actorId` accepte `string | number` → sérialisation hétérogène en base.

## ✅ Points positifs (à préserver)

- Découplage par event bus : les use cases ignorent l'audit (bon).
- Connexion DB `audit` séparée (isolation I/O, sécurité).
- Fallback `ledger_log` sur échec d'écriture.
- Dégradation gracieuse du détecteur si le compteur (Redis) est indisponible.
- Helper business unifié (`emitBusinessAudit`) + capture IP/canal/géo cohérente (récent).

---

## Recommandations priorisées

### Quick wins (faible risque, fort rendement)
1. **Indexer `audit_logs`** (C2) : migration additive — `created_at`, `(event_category, created_at)`,
   `(actor_type, actor_id, created_at)`, `(target_type, target_id)`, `result`.
2. **Canonicaliser le contrat** (C3) : enums/constantes partagées `AuditCategory`, `AuditAction`,
   `ActorType` ; `actorId` = **une** identité (choisir : usersUid public partout). Typer
   `AuditRecordInput` sur ces enums.
3. **Corriger l'enrichissement** (M1) : normaliser `actorType` (`Admin`/`User`) et résoudre les
   noms User (via un service de lookup) en plus des admins.

### Design (à brainstormer — objet de la prochaine session)
4. **Refondre `SecurityAlertDetector`** (C1) : règles par (catégorie, action, result) déclaratives ;
   couvrir échecs auth business + `PERMISSION_DENIED` → `PRIVILEGE_ESCALATION` ; PIN + OTP.
5. **Observabilité admin** (M3) : promouvoir en colonnes indexées les axes clés (`channel`,
   `geo_country`, `is_vpn`) ou passer sur un store requêtable ; endpoints d'agrégation
   (compteurs par action/acteur/période) pour un vrai dashboard, pas qu'une liste.
6. **Durabilité** (M4) : outbox/at-least-once pour l'écriture d'audit (au moins pour les
   catégories à valeur légale : AUTH, LEDGERS, MEMBERSHIP).
7. **Uniformiser la couche d'émission** (M2) : décider où vit l'audit (use case vs présentation)
   et l'appliquer partout ; définir la politique succès/échec par catégorie.
8. **Rétention** (Mn3) : partitionnement par date + purge/archivage, durée alignée conformité.

## Questions ouvertes pour le brainstorm
- Taxonomie cible des **catégories/actions** (référentiel figé, versionné ?).
- **Identité d'acteur** unique : usersUid public partout (et admin id → uid aussi ?).
- Niveau de **durabilité** requis par catégorie (best-effort vs at-least-once).
- Modèle d'**observabilité admin** : liste filtrable seule, ou dashboards agrégés + alerting ?
- **Rétention**/conformité (RGPD : IP/UA) : durée, anonymisation, export.
