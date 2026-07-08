---
status: draft
etape: 3
lot: A
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

## Découpage (validé 2026-07-08)

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| A — Fondation RBAC | catalogue permissions (code) + tables org_role + org_role_permission + rôles par défaut seedés (OWNER…) + table org_member ; owner devient membre OWNER à la création d'org | — | design en cours |
| B — Membres | ajouter (KYC-vérifié + OTP consentement + confirm), lister, changer rôle, retirer | A | à faire |
| D — Enforcement | token business scopé (user, org active, permissions) + middleware par permission (gate produit §4.6) | A, B | à faire |
| C — Rôles éditables | CRUD des rôles de l'org (composer depuis le catalogue) | A | à faire |

Ordre : A → B → D → C.

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

## Hors-scope (à confirmer)

- (à remplir à l'étape 3 — YAGNI)

## Prochaine session

Étape 3 sur le Lot A (approche de la fondation RBAC). Prochaine décision : RBAC produit-owned vs
réutilisation du RBAC team du core.