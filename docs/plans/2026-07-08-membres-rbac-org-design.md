---
status: in-review
etape: 4
lot: D
derniere_maj: 2026-07-08
---

# Membres & RBAC par organisation — Design (Lot 6, sous-lot 3)

Module produit **aiglebusiness**, feature `organisation` (ou nouvelle feature `membership`).
Objectif : permettre à une organisation d'avoir plusieurs membres, chacun avec un rôle qui
détermine ce qu'il peut faire dans l'org (RBAC produit).

## Contexte (exploré 2026-07-08)

**Doc centrale** : §4.3 = membre = user Aigle **déjà KYC-vérifié** (sinon arrêt + erreur claire) ;
ajout via **OTP de consentement** ; le membre opère le compte de l'org via son **rôle** (pas de
nouveau compte). §4.6 = **RBAC par rôle (produit)** ; token business scopé **(user, org active,
rôle)** ; deux portes (produit gate par rôle, core gate par compte + limites). Multi-org
asymétrique : rôle et compte **par org**. Back-office admin : « chaque couche déclare ses
permissions **en code** (permissions.config.ts) ».

**Existant core — RBAC team (admin back-office)** : RBAC riche, tables `role`(slug/name) +
`permission`(slug/name) + role_permission + admin_role, CRUD complet. **Global admin, pas scopé
org** → pas directement réutilisable pour les membres d'org (sujet = admins, pas users ; portée =
plateforme, pas org).

**Existant legacy (client-api) — organisation_member** : modèle **plat** — ligne membre
{organisation_id, user_id, display_name, role (string), hierarchy_level, booléens de capacité
(can_initiate_mass_payment, can_invite_members)}. Pas de tables rôle/permission par org. Controller
legacy : listMembers / addMember / updateRole / updatePermissions / inviteMember / confirmInvitation.

**Existant core — OTP** : `OtpSendingService.send(identifier, userId, template)` (+ templates
domain) → réutilisable pour l'OTP de consentement d'ajout de membre.

**État feature** : `products/aiglebusiness/organisation` = create/list org, marchand LEVEL_1 + QR.
L'org a un `owner_user_id` (le créateur). Pas encore de table membres.

Zones de risque : (1) le grain du RBAC (rôles fixes en code vs rôles/permissions éditables par org) ;
(2) l'enforcement (scope du token business + middleware par permission) touche l'auth ; (3) le lien
owner ↔ membre (le créateur doit-il devenir le premier membre « owner ») ; (4) réutilisation OTP core
cross-produit (business → identity/otp).

## Objectif

On construit un **RBAC complet par organisation** — catalogue de **permissions déclarées en code**,
**rôles composables par l'org** (piochant dans le catalogue), **membres** rattachés à une org avec
un rôle, ajout via **OTP de consentement**, et **enforcement produit** (le token business gate par
permission). Pour que chaque org gère ses membres et ce qu'ils peuvent y faire. Réussi si : un owner
peut créer des rôles, ajouter un membre (user KYC-vérifié, qui consent par OTP), lui assigner un
rôle, et que le membre ne puisse faire que ce que son rôle autorise. Mêmes principes que le
back-office admin (§4.6) → bases extensibles.

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| 1 | RBAC org **riche** : catalogue de permissions en CODE + rôles composables par l'org + assignés aux membres (même pattern que le back-office admin §4.6) | Rôles fixes code-only (pas assez flexible) ; plat legacy booléens (ingérable) | User « tout prendre + poser les bonnes bases » ; cohérence avec le RBAC §4.6 déjà établi | 2026-07-08 |
| 2 | **A1 — RBAC produit-owned** : tables + catalogue dans aiglebusiness, indépendant du RBAC team du core | A2 réutiliser core/team (couple business→team, mélange admins/users) ; A3 hybride | Sujets distincts (users membres ≠ admins staff), portée par-org vs globale, invariant produit↛core | 2026-07-08 |
| 3 | Permissions = **slugs en code seulement** (permissions.config.ts), pas de table permission ni sync ; org_role_permissions stocke le slug | Table permission synchronisée (comme admin) | Permissions business fixes, source unique = code, plus simple | 2026-07-08 |
| 4 | **RBAC membres/rôles = préoccupation ENTREPRISE.** Marchand = mono-user (owner=seul membre, rôle OWNER, pas d'ajout de membre ni gestion de rôles). Entreprise = multi-membres + rôles. OWNER seedé pour les deux ; ADMIN/OPERATOR/VIEWER + gestion membres = entreprise uniquement | Traiter marchand et entreprise pareil | §4.3 marchand mono-user / entreprise multi-membres | 2026-07-08 |
| 5 | ~~Seeder OWNER+ADMIN+OPERATOR+VIEWER~~ **RÉVISÉ → seeder OWNER SEUL** (les deux types) ; l'owner crée les autres rôles lui-même | Seeder un jeu par défaut | User : « le reste c'est le owner qui se charge » | 2026-07-08 |
| 6 | Catalogue de permissions = `{slug, name, description, sensitive:boolean}` ; **endpoint de listing** du catalogue (l'owner compose ses rôles, la description + le flag sensitive le guident) | Slug seul sans métadonnées | UX : l'owner doit comprendre et être alerté sur les permissions sensibles | 2026-07-08 |
| 7 | **Réordonner le découpage → A → C → B → D** (rôles avant membres) | Garder A→B→D→C | Conséquence de #5 : seed OWNER seul → il faut un rôle avant d'ajouter un membre (OWNER unique, non assignable) | 2026-07-08 |
| 8 | Gating **via Bouncer** (comme l'admin) : policy scopée par org + helper `memberHasPermission(userId, orgId, slug)` (charge membre→rôle→permissions ; OWNER bypass). Endpoints → `bouncer.with(Policy).authorize('x', organisation)`. Le Lot D ajoutera le middleware déclaratif + token par-dessus | assertCan service maison ; check owner minimal jeté | Réutilise le pattern Bouncer existant (permission_helpers admin), pose les bonnes bases | 2026-07-08 |
| 9 | Catalogue permissions exposé **scopé org** (`GET .../organisations/:id/permissions-catalog`, gardé `roles:manage`) au lieu de global `/api/business/permissions` | endpoint global (public ou auth simple) | Cohérent avec la porte Bouncer par org ; l'écran de composition d'un rôle est déjà dans le contexte d'une org ; pas d'endpoint public superflu | 2026-07-08 (impl. Lot C) |
| 10 | ~~OTP de consentement saisi par l'invité dans SA session (`me/invitations`)~~ **SUPERSÉDÉ par #14** | — | Hypothèse « l'invité a une app » fausse : espace entreprise = portail web, invité pas forcément marchand/AigleBusiness | 2026-07-08 → révisé |
| 11 | **Retrait = soft** : `MemberStatus += REMOVED`. `memberHasPermission` ne compte que `ACTIVE`. `UNIQUE(org,user)` → réinvitation = réactiver la ligne existante (PENDING/REMOVED → repasse en flux invite) | hard delete | Historique/audit fintech, réactivation possible, trace « a été membre / a décliné » | 2026-07-08 (design Lot B) |
| 12 | **Pas de plafond de membres** (MVP) | plafond configurable (esprit legacy MAX=4) | Le plafond legacy tenait à l'ancien modèle ; plafond par palier KYB possible plus tard si besoin | 2026-07-08 (design Lot B) |
| 13 | **Notification invité = SMS + OTP** (canal garanti). On n'assume **aucune app** côté invité : il n'est pas forcément marchand, l'espace entreprise se gère surtout en **portail web**, AigleBusiness pas garanti. L'OTP est **conservé et porteur** (facteur possession, car notif SMS ≠ app d'acceptation) | push AigleBusiness only (app non garantie) ; supprimer l'OTP (aurait exigé notif+accept même session) | Seul le tel est un point de contact certain ; SMS+OTP marche quels que soient les clients installés | 2026-07-08 (design Lot B) |
| 14 | **Acceptation par lien web tokenisé + OTP**, **calquée sur la feature core `team`** (`create_admin` : ligne inactive + `invitationToken` uuid +expiry → lien `dashboard/setup-password?token=` → validation token **puis** OTP). Ici : OWNER invite → membre `PENDING` + `invitationToken` +expiry ; **SMS** avec lien `BUSINESS_PORTAL_URL/accept-invitation?token=` ; à l'ouverture, envoi **OTP** (SMS) ; saisie OTP → `ACTIVE`. Endpoints **semi-publics** (le token est le credential + OTP 2e facteur) | accept in-session (#10, app non garantie) ; endpoint purement public sans token | Réutilise un pattern d'invitation web **déjà éprouvé** dans le core ; zéro app requise ; token+OTP = 2 facteurs | 2026-07-08 (design Lot B) |
| 15 | **Divulgation contrôlée sur l'endpoint token (semi-public)** : `GET /invitations/:token` renvoie **`{organisationName, phoneMasked}`** (l'invité doit reconnaître qui l'invite et sur quel numéro confirmer) **mais PAS le rôle** (caché jusqu'à l'acceptation) + déclenche l'OTP | tout renvoyer (rôle inclus) ; ne rien renvoyer du tout | Équilibre UX/confidentialité : org+phone masqué nécessaires pour reconnaître l'invitation ; le rôle (niveau de droits) n'est révélé qu'une fois le consentement OTP donné | 2026-07-08 (design Lot B) |
| 16 | **Retrait selon statut** : PENDING → **hard delete** (annulation d'invitation, invalide le token) ; ACTIVE → **REMOVED** soft (#11). Même route DELETE, verbe résolu par le statut courant. OWNER seed → 403 | soft REMOVED uniforme | PENDING = cycle *invitation* (jamais adhérent, rien à historiser, audit log suffit), pas cycle *adhésion* ; évite les REMOVED jamais-membres | 2026-07-08 (design Lot B) |
| 17 | **Token invitation = 48h** ; OTP = fenêtre courte propre (~10 min, envoyé à l'ouverture du lien). Deux timers distincts. `resend` régénère un token si expiré | 5 min (team, mais team = email+action immédiate) ; 7j (fenêtre d'exposition trop longue) | Invité par SMS peut ne pas réagir tout de suite ; 48h raisonnable, l'OTP reste le 2e facteur court | 2026-07-08 (design Lot B) |
| 18 | **Le produit consomme le core identité via un PORT de service** (`UserDirectoryService` → `UserLookupResult` minimal : userId, nom, phone, `kycVerified` booléen), **jamais** via `UserRepository` ni le modèle `User`. Règle depcruise `produit-consomme-core-par-service` (warn) l'enforce | injecter `UserRepository`/`User` dans les use cases produit (violation d'indépendance des couches) | Anti-corruption : le core n'expose qu'un contrat minimal ; l'enum KYC reste interne ; condition de l'extractibilité en micro-services EN COUCHE | 2026-07-08 (correctif impl. Lot B) |
| 19 | **Enforcement Lot D = middleware déclaratif + résolution LIVE, org depuis l'URL, token INCHANGÉ.** Un `requirePermission('slug')` lit `:organisationId` (URL) + `auth.user` et vérifie `memberHasPermission` en live (filtre ACTIVE). Pas de scope d'org ni de permissions dans le token | token scopé (org active + permissions dans les abilities) ; hybride org-en-token | Révocation immédiate (pas de staleness) ; multi-org naturel via l'URL ; zéro flux auth supplémentaire ; bake de permissions dans un token = anti-pattern sécurité | 2026-07-08 (design Lot D) |
| 20 | **Le middleware REMPLACE Bouncer** (révise #8) : `requirePermission` appelle `memberHasPermission` directement ; les policies `OrganisationRolePolicy`/`OrganisationMemberPolicy` et les `bouncer.with(...).authorize()` des contrôleurs sont **supprimés**. Une seule mécanique de gating, au niveau route | garder Bouncer et l'appeler depuis le middleware (policy générique artificielle) ; garder les deux (redondant) | Moins de code, gating en un seul endroit lisible ; les policies par-permission figées s'adaptent mal à un `requirePermission(slug)` générique | 2026-07-08 (design Lot D, révise #8) |

## Découpage (validé 2026-07-08)

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| A — Fondation RBAC | catalogue permissions (code, +description +sensitive) + tables org_roles + org_role_permissions + org_members ; **seed OWNER seul** ; owner devient membre OWNER à la création d'org | — | **implémenté** (66/66) |
| C — Rôles éditables | CRUD des rôles de l'org (composer depuis le catalogue) + endpoint listing du catalogue | A | **implémenté** (16/16) |
| B — Membres | ajouter (KYC-vérifié + OTP consentement + confirm), lister, changer rôle, retirer (entreprise) | A, C | à faire |
| D — Enforcement | token business scopé (user, org active, permissions) + middleware par permission (gate produit §4.6) | A, B | à faire |

Ordre : **A → C → B → D** (rôles avant membres, cf. décision #7).

## Lot A — Design

### Architecture (validée)

- **Feature** `app/products/aiglebusiness/membership/` (4 couches), sœur de `organisation` ;
  référence `organisation_id` par valeur.
- **Catalogue de permissions en CODE** (`permissions.config.ts`) = slugs des capacités business,
  source de vérité unique. Pas de table permission ni de sync. `org_role_permissions` stocke le
  slug (validé contre le catalogue à l'écriture).
- **Rôle** = par org, compose des permissions du catalogue ; rôles par défaut seedés (`is_system`).
- **Membre** = user rattaché à une org avec un rôle.
- **Tables** :
  - `org_roles` (id, organisation_id, slug, name, is_system, timestamps ; UNIQUE org_id+slug)
  - `org_role_permissions` (role_id, permission_slug)
  - `org_members` (id, organisation_id, user_id, role_id, status, timestamps ; UNIQUE org_id+user_id)

### Catalogue de permissions + rôles par défaut (validé)

**Catalogue** (`permissions.config.ts`, extensible). Chaque entrée = `{ slug, name, description,
sensitive:boolean }`. Un **endpoint de listing** l'expose (l'owner compose ses rôles ; description +
flag `sensitive` le guident). Permissions : `organisation:manage`, `members:manage`, `roles:manage`,
`kyb:submit`, `kyb:view` (sensible — données KYB entreprise), `qr:manage`,
`payout:initiate` (sensible), `payout:approve` (sensible), `provision:request` (sensible —
approvisionnement), `transactions:view`, `wallet:view`.

**Seeding à la création** : **OWNER SEUL**, pour les deux types (marchand + entreprise). OWNER =
toutes permissions, unique, protégé (non supprimable/rétrogradable), attribué au créateur.
L'entreprise crée ensuite SES rôles (Lot C) — ADMIN/OPERATOR/VIEWER ne sont que des exemples, pas
seedés. Marchand = OWNER seul à vie.

### Impact sur l'existant + flux + tests (validé)

- **`CreateOrganisationUseCase`** : dans la même transaction (après `openFor`), appelle
  `MembershipService.seedForNewOrganisation(orgId, ownerUserId, trx)` = seede le rôle **OWNER**
  (org_roles + org_role_permissions = toutes les permissions du catalogue) + crée le **membre
  OWNER** (le créateur). Identique marchand/entreprise (OWNER seul). Atomique (rollback si échec).
- **Dépendance** organisation → membership (intra-produit, une direction ; membership référence
  organisation_id par valeur → pas de cycle).
- **Tests Lot A** : marchand ET entreprise → 1 rôle OWNER (is_system, toutes perms) + 1 membre OWNER
  (= owner) ; étendre `organisation_flow.spec`.

## Lot C — Design

### Architecture (validée)

- **Endpoints** (canal client, feature membership) : `GET /api/business/permissions` (catalogue) ;
  `GET/POST /api/business/organisations/:organisationId/roles` ; `PATCH/DELETE .../roles/:roleId`.
- **Autorisation Bouncer** (décision #8) : helper `memberHasPermission(userId, organisationId, slug)`
  (membership/application/authorization) + policy `OrganisationRolePolicy.manage(user, organisation)`
  → `memberHasPermission(user.usersUid, org.organisationId, 'roles:manage')`. Contrôleur : charge
  l'org → rejette si marchand (#4) → `bouncer.with(OrganisationRolePolicy).authorize('manage', org)`.
- **Use cases** `membership/application/use_cases/roles/` (create/update/delete/list + list perms) ;
  `OrganisationRoleRepository` étendu (update/delete/listByOrganisation/findById).
- **Routes** via `membershipClientRoutes` (start/routes).

### Règles & validation (validées)

- OWNER protégé : rôle `is_system`/slug `owner` non éditable/supprimable (403).
- Slug généré du `name` (slugify), immuable, unique par org (nom dupliqué → 409).
- Permissions validées contre le catalogue (`isValidPermissionSlug`, ≥1) → **400** sinon.
- Marchand : CRUD rôles rejeté (#4).
- Supprimer un rôle avec membres → 409 (réassigner d'abord). **DIFFÉRÉ au Lot B** : au Lot C aucun
  membre ne porte de rôle non-système (les membres arrivent au Lot B), le garde-fou n'est pas
  exerçable → on l'ajoute au Lot B avec `OrganisationMemberRepository.countByRole`.
- Éditer = name + remplacement complet des permissions (delete+insert en transaction). Rôle
  introuvable/autre org → 404.
- Exceptions : SystemRoleImmutable(403), RoleNameAlreadyExists(409), InvalidPermissionSlug(**400**),
  RoleHasMembers(409), RoleNotFound(404).
- **Doc API** : ajouter les endpoints au `docs/swagger/business.yaml` (spec aiglebusiness).

### Tests (validés)

- **`memberHasPermission`** : OWNER → true (toute permission) ; user non-membre → false.
- **Use cases rôles** (container.make) : create (entreprise) ; slug permission invalide → 400 ;
  nom dupliqué → 409 ; marchand → rejet ; update (name + remplacement perms) ; delete ; OWNER
  immuable → 403 ; delete rôle avec membres → 409 (setup direct ou différé Lot B).
- **HTTP + Bouncer** : user + token, owner d'une org → POST role passe ; user non-membre → 403.
- **Catalogue** : GET /api/business/permissions → 11 permissions avec `sensitive`.

## Lot B — Design (membres, décisions #10–#17)

Entreprise uniquement (#4). Feature `aiglebusiness/membership/`. Consentement = **lien web
tokenisé + OTP**, calqué sur la feature core `team` (#14), invité notifié par **SMS** (#13).

### Architecture

**Modèle** : `OrganisationMember` gagne `invitationToken: string|null` (+index), `invitationExpiresAt:
DateTime|null`. Enum `MemberStatus += REMOVED` (applicatif, colonne `status` déjà VARCHAR).

**Endpoints OWNER** (canal `client`, policy `OrganisationMemberPolicy.manage` = permission `members:manage`) :
| Méthode | Route | Rôle |
|---|---|---|
| GET | `.../organisations/:organisationId/members` | lister (ACTIVE/PENDING/REMOVED) + rôle |
| POST | `.../organisations/:organisationId/members` | inviter `{phone, roleId}` → PENDING + token + SMS lien |
| POST | `.../organisations/:organisationId/members/:memberId/resend` | régénérer token + renvoyer SMS |
| PATCH | `.../organisations/:organisationId/members/:memberId/role` | changer `{roleId}` |
| DELETE | `.../organisations/:organisationId/members/:memberId` | retirer (PENDING→delete, ACTIVE→REMOVED, #16) |

**Endpoints invité** (semi-publics, le token EST le credential + OTP 2e facteur) :
| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/business/invitations/:token` | valide token (404/410) → renvoie **`{organisationName, phoneMasked}`** (PAS le rôle, #15) **et envoie l'OTP** |
| POST | `/api/business/invitations/:token/accept` | `{otp}` → vérifie OTP → ACTIVE, token effacé |
| POST | `/api/business/invitations/:token/decline` | → REMOVED (optionnel) |

SMS porte `BUSINESS_PORTAL_URL/accept-invitation?token=…`. Token→membre→user→phone résolu serveur
(l'invité ne saisit jamais son tel). OTP via services **core** `OtpSendingService`/`OtpVerificationService`
+ `MembershipConsentOtpTemplate`. Token 48h, OTP ~10 min (#17).

**Use cases** (`membership/application/use_cases/members/`) : Invite, ResendInvitation, ListMembers,
ChangeMemberRole, RemoveMember, GetInvitationByToken (+OTP), AcceptInvitation, DeclineInvitation.

**Repo étendu** `OrganisationMemberRepository` : findByOrganisationAndUser, findById,
findByInvitationToken, listByOrganisation, updateStatus, updateRole, setInvitationToken, delete,
**countActiveByRole** (garde-fou delete rôle Lot C).

### Flux & erreurs

**Invite** : Bouncer `members:manage` → `roleId` ∈ org (404 sinon) → `findByPhone` (404 pas de compte
Aigle) → KYC VERIFIED (403 sinon) → selon ligne `(org,user)` (#11) : ACTIVE→409, PENDING→régénère
token, REMOVED→repasse PENDING+roleId, aucune→INSERT PENDING → SMS lien.

**Accept** : `GET :token` (404 absent / 410 expiré) envoie OTP ; `POST :token/accept {otp}` re-valide
token + `OtpVerificationService.verify` (propage invalid/expired/locked core) → PENDING→ACTIVE.

**Exceptions produit** : MemberAlreadyExists(409), InviteeNotAigleUser(404), InviteeKycNotVerified(403),
InvitationTokenInvalid(404), InvitationExpired(410), MemberNotFound(404), OwnerMemberImmutable(403).
OTP → exceptions **core** réutilisées.

### Impact sur l'existant

1. **⚠️ `memberHasPermission` filtre `status = ACTIVE`** (correctif Lot C : aujourd'hui non filtré →
   PENDING/REMOVED serait autorisé). Rétro-couvert par tests.
2. **`DeleteRoleUseCase`** : câble `countActiveByRole > 0` → 409 `RoleHasMembersException` (différé Lot C).
3. **Migration batch 10** : colonnes `invitation_token`(+index)/`invitation_expires_at` sur
   `organisation_members`. Enum REMOVED = applicatif (pas de DDL).
4. **Config** : `BUSINESS_PORTAL_URL` (env.ts + config/app.ts, comme ADMIN_DASHBOARD_URL).
5. **Core : ajout d'un port de service** `UserDirectoryService` (+ `UserLookupResult`) dans
   `core/identity/user/application/` — frontière anti-corruption identité→produit (décision #18).
   Aucune modification du comportement core existant ; invariant depcruise intact.

### Tests

- **Use cases** : invite (succès ; 404 pas de compte ; 403 KYC ; 404 roleId ; 409 ACTIVE ; REMOVED→PENDING ;
  PENDING→régénère) ; accept (OK ; 404 ; 410 ; OTP faux ; déjà ACTIVE) ; changeRole (OWNER 403 ; hors org 404) ;
  remove (PENDING hard delete ; ACTIVE→REMOVED ; OWNER 403) ; decline.
- **Régression RBAC** : `memberHasPermission` PENDING→false, REMOVED→false, ACTIVE selon rôle, OWNER bypass ;
  `DeleteRoleUseCase` rôle avec membre ACTIVE → 409.
- **HTTP** : OWNER invite 201 ; non-membre 403 ; sans token 401 ; `GET :token` renvoie {org, phoneMasked}
  sans rôle + déclenche OTP ; `POST accept` 200 ACTIVE.
- **Doc API** : endpoints ajoutés à `docs/swagger/business.yaml`.

## Hors-scope (confirmé)

- Rôles ADMIN/OPERATOR/VIEWER **non seedés** (exemples doc seulement ; l'org les crée au Lot C).
- Table permission en base (permissions = code seul).
- Enforcement (Lot D) — lot ultérieur.
- Notification **push** de l'invité (amélioration future ; MVP = SMS seul, #13).

## Prochaine session

**Lot A : IMPLÉMENTÉ ✅** — feature `aiglebusiness/membership/` (permissions.config 11 slugs dont
kyb:view + provision:request sensibles ; models OrganisationRole/RolePermission/Member ; repos ;
MembershipService.seedForNewOrganisation), câblé dans CreateOrganisationUseCase (seed OWNER +
membre OWNER, atomique), migrations batch 9, tests membership_flow (marchand+entreprise). tsc 57,
functional 66/66, depcruise 0 error.

**Lot C : IMPLÉMENTÉ ✅** — feature `aiglebusiness/membership/` :
- Use cases `application/use_cases/roles/` : Create/Update/Delete/ListRoles + ListPermissionsCatalog.
- Helper `memberHasPermission` + policy `OrganisationRolePolicy.manage(user, organisationId)` (Bouncer,
  scopé org), câblée dans RoleController + PermissionController.
- DTOs `role.dto.ts` (Create/Update Request + RoleResponse) et `permission.dto.ts` (catalogue).
- Validateurs Vine (create/update role), routes `membershipClientRoutes` montées dans start/routes.
- `assertValidPermissions` remontée dans `permissions.config` (domaine) ; map `BUSINESS_PERMISSION`
  de slugs nommés pour les policies.
- **Écart assumé vs design** : le catalogue est exposé **scopé org** `GET /api/business/organisations/
  :organisationId/permissions-catalog` (gardé par `roles:manage`) plutôt que global `/api/business/
  permissions` — cohérent avec la porte Bouncer par org et évite un endpoint public inutile.
- Doc API : endpoints + schémas ajoutés à `docs/swagger/business.yaml`.
- Tests `role_management_flow.spec` : **16/16** (use cases, memberHasPermission, HTTP+Bouncer 200/403/401).
- **Aucune migration** (pas de changement de schéma — tables posées au Lot A).
- Vérifs : tsc sans erreur membership, depcruise 0 error (invariant core intact).

**Lot B : IMPLÉMENTÉ ✅** — feature `aiglebusiness/membership/` :
- Fondations : `MemberStatus += REMOVED`, colonnes `invitationToken`/`invitationExpiresAt`
  (migration batch 10), config `businessPortalUrl`.
- 7 exceptions membres, `MembershipConsentOtpTemplate`, `InvitationService` (token 48h + SMS lien
  via `NotificationService` core).
- Repo membre étendu (findById, findByOrganisationAndUser, findByInvitationToken, listByOrganisation,
  updateStatus, updateRole, setInvitation, delete, `countActiveByRole`) + `OrganisationRepository.findByOrganisationId`.
- 8 use cases : Invite, ResendInvitation, ListMembers, ChangeMemberRole, RemoveMember, GetInvitation
  (+OTP), AcceptInvitation, DeclineInvitation.
- Présentation : `OrganisationMemberPolicy` (`members:manage`), MemberController + InvitationController,
  validators Vine, routes (gestion authentifiée + invitation **semi-publique** token+OTP).
- **Correctifs** : `memberHasPermission` filtre `ACTIVE` (faille fermée) ; `DeleteRoleUseCase` → 409
  si rôle porté par un membre actif (garde-fou différé du Lot C).
- **Anti-corruption (décision #18)** : produit → core identité via `UserDirectoryService` (port core,
  DTO minimal), plus aucun `UserRepository`/modèle `User` dans le produit. Règle depcruise
  `produit-consomme-core-par-service` (warn) l'enforce.
- Doc API : endpoints membres + invitations ajoutés à `docs/swagger/business.yaml`.
- Tests `member_management_flow.spec` : **16/16** (invitation/gardes, accept token+OTP, changeRole,
  retrait soft/hard, correctifs RBAC). Suite membership complète : **34/34**.
- Vérifs : tsc sans erreur membership, depcruise **0 error** (invariant core intact), eslint clean.

> ⏸️ **Lot D EN PAUSE (2026-07-08)** : design Lot D validé jusqu'aux décisions #19/#20 (middleware
> `requirePermission` live + suppression des policies Bouncer), mais **suspendu** pour concevoir
> d'abord les fondations **auth multi-app & gestion d'appareils** (les deux apps partagent la même
> auth, sans distinction ni device management web). Voir `docs/plans/2026-07-08-auth-multi-app-device-design.md`.
> Reprendre le Lot D après.

**Prochain : Lot D** (enforcement : middleware déclaratif par permission + scoping token business
par-dessus `memberHasPermission`). Restent aussi hors-Lot : notification push invité (amélioration),
KYB (génère le QR entreprise à l'approbation), mass-payout/paiements.

> ⚠️ 4 tests **core** échouent hors périmètre (3 KYC unit process/submit ; 1 ProviderErrorService
> ACCOUNT_BLOCKED). Pré-existants, reproduits en isolation, sans lien avec le Lot B.
> ⚠️ Dette révélée par la nouvelle règle depcruise : `aiglesend/operations/recipient_locator.ts`
> importe `country_repository` (core) — à migrer vers un service core (hors périmètre Lot B).

> ⚠️ 4 tests **core** échouent déjà hors périmètre (3 KYC unit : process/submit ; 1 ProviderErrorService
> ACCOUNT_BLOCKED→adminAction). Reproduits en isolation → pré-existants, sans lien avec le Lot C.