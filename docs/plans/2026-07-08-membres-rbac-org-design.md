---
status: draft
etape: 2
lot: -
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

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|

## Hors-scope (à confirmer)

- (à remplir à l'étape 3 — YAGNI)

## Prochaine session

Étape 2 en cours (clarifier l'objectif). Prochaine décision : le grain du RBAC org (rôles fixes
code vs éditables).