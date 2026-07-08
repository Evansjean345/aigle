---
status: in-review
etape: 5
lot: C
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

## Découpage (validé 2026-07-08)

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| A — Fondation RBAC | catalogue permissions (code, +description +sensitive) + tables org_roles + org_role_permissions + org_members ; **seed OWNER seul** ; owner devient membre OWNER à la création d'org | — | design en cours |
| C — Rôles éditables | CRUD des rôles de l'org (composer depuis le catalogue) + endpoint listing du catalogue | A | à faire |
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
- Supprimer un rôle avec membres → 409 (réassigner d'abord ; pas de cascade sur org_members.role_id).
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

## Hors-scope (confirmé)

- Rôles ADMIN/OPERATOR/VIEWER **non seedés** (exemples doc seulement ; l'org les crée au Lot C).
- Table permission en base (permissions = code seul).
- Enforcement (Lot D), gestion membres (Lot B), CRUD rôles (Lot C) — lots ultérieurs.

## Prochaine session

**Lot A : IMPLÉMENTÉ ✅** — feature `aiglebusiness/membership/` (permissions.config 11 slugs dont
kyb:view + provision:request sensibles ; models OrganisationRole/RolePermission/Member ; repos ;
MembershipService.seedForNewOrganisation), câblé dans CreateOrganisationUseCase (seed OWNER +
membre OWNER, atomique), migrations batch 9, tests membership_flow (marchand+entreprise). tsc 57,
functional 66/66, depcruise 0 error.

**Lot C : design COMPLET** (architecture Bouncer + règles/validation + tests, décision #8). Prêt à
implémenter. Prochain : implémenter le Lot C, puis Lot B (membres + OTP consentement), puis Lot D
(enforcement : middleware déclaratif + scoping token par-dessus le helper memberHasPermission).