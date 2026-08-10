---
status: livré
# Constaté le 2026-08-05 : `AdminAuthService` et ses gardes de tentatives sont en place.
etape: 6
lot: -
derniere_maj: 2026-07-09
---

# Déplacement de l'auth admin : primary `identity` → support — Design

L'authentification admin (back-office) vit aujourd'hui dans le **primary core** `identity/authentication`
(sous-dossiers `admin/` par couche), alors qu'elle authentifie une entité **support** (`Admin`, contexte
`team`). Résultat : le primary `identity` **dépend du support `team`** (inversion de dépendance). Objectif :
sortir l'auth admin de `identity` vers le côté support, en réutilisant les primitives réutilisables de
l'identity (OTP), pour rendre `identity` primary-pur sur ce point.

## Contexte (exploré 2026-07-09)

**Surface auth admin** (dans `app/core/identity/authentication/`, sous-dossiers `admin/`) :
- `application/dtos/admin/` : admin_login.dto, setup_admin_password.dto
- `application/services/admin/` : admin_auth_service, admin_attempt_guard, admin_otp_attempt_guard
- `application/use_cases/admin/` : admin_login, admin_refresh_token, setup_admin_password, verify_admin_otp
- `presentation/admin/` : admin_management_controller, admin_auth_routes, admin_validator

**Dépendances** :
- → **`team`** (support) : `Admin` (modèle), `AdminRepository`, exceptions admin. C'est l'entité authentifiée.
- → **`identity/otp`** (primary primitive) : `OtpSendingService`, `OtpVerificationService`, et les templates
  `admin_login_otp_template` / `admin_setup_otp_template` (qui vivent dans `identity/otp/domain/templates/`
  mais ne servent QUE l'auth admin).

**Infra** :
- **DI** : services `@inject` concrets, auto-résolus par le conteneur — pas de binding explicite à déplacer.
- **Routes** : `adminAuthRoutes` (`presentation/admin/routes/`) monté dans `start/admin_routes.ts`.
- **Guard** : `config/auth.ts` guard `admin` → `#core/team/domain/models/admin` (déjà côté team, inchangé).

**Zone de nuance (hors périmètre de CE déplacement)** : `identity` garde d'autres liens vers `team`,
d'une catégorie différente — surfaces **admin-facing** sur des entités **primary** :
`kyc/presentation/admin/policies/kyc_policy`, `kyc/domain/models/*` (Admin en relation), et
`user/presentation/admin/controllers/users_controller`. Ce sont des présentations/policies gardées par le
RBAC team, arguablement légitimes. Le présent design ne traite QUE l'auth admin (le cas le plus net).

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| 1 | **Auth admin déplacée dans `core/team/authentication/`** (sous-feature : application/{services,use_cases,dtos} + presentation/{controllers,routes,validators}). team possède déjà `Admin` + le RBAC → devient le contexte back-office COMPLET (identité + authz admin), miroir d'`identity` pour les users | nouveau module `core/admin/` (fragmente, dépendrait de team pour Admin) ; `identity/admin_authentication/` (reste dans identity → ne corrige pas l'inversion) | Cohésion : une seule maison pour tout l'admin ; `identity` cesse de dépendre de `team` (via l'auth) | 2026-07-09 |
| 2 | **Templates OTP admin déplacés dans `team/authentication/domain/templates/`** (ils étendent `OtpMessageTemplate`, base qui **reste** dans `identity/otp`). `identity/otp` ne garde que les templates génériques/user | les laisser centralisés dans `identity/otp` | Chaque contexte possède le contenu de ses messages (cohérent avec le template membership) ; `identity/otp` redevient une primitive générique | 2026-07-09 |

## Architecture (validée 2026-07-09)

**Déplacements** (`identity` → `team/authentication/`) :
- `authentication/application/{dtos,services,use_cases}/admin/*` → `team/authentication/application/{dtos,services,use_cases}/`
- `authentication/presentation/admin/*` → `team/authentication/presentation/*`
- `otp/domain/templates/admin_{login,setup}_otp_template.ts` → `team/authentication/domain/templates/`

**Rewire** : refs intra-admin → `#core/team/authentication/…` ; templates admin (dans les use cases) →
`#core/team/authentication/domain/templates/…` ; base `OtpMessageTemplate` **reste** `#core/identity/otp/…` ;
primitives OTP + `team` (Admin/repo/exceptions) inchangés ; `start/admin_routes.ts` : chemin de `adminAuthRoutes`.

**Inchangé** : `config/auth.ts` (guard admin → team/Admin), DI (services `@inject` auto-résolus).

**Invariant** : règle depcruise `identity-authentification-ne-depend-pas-de-team` (**error**, 0 violation après
le déplacement). Résiduel `identity → team` (kyc/user admin) hors périmètre — non durci.

**Tests** : auth admin non testée → rien à déplacer (dette [[pre-prod-admin-tests]] persiste, futurs tests sous team).

**Une seule référence externe** : `start/admin_routes.ts`. Déplacement pur, comportement identique.

## Prochaine session

Design approuvé. Implémentation : git mv + rewire + règle depcruise + vérifs (tsc, depcruise 0 error,
`identity/authentication` sans `team`, boot).
