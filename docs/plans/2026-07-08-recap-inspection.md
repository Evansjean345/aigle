# Récapitulatif d'inspection — session du 2026-07-08

Deux sous-projets livrés sur la branche `feat/core-consolidation`, chacun avec son document de
design (registre de décisions). État global des vérifs : **tsc clean**, **depcruise 0 error**
(2 invariants durs), **suite 191/195** (4 échecs **core pré-existants** hors périmètre : 3 KYC unit
+ 1 ProviderErrorService, reproduits en isolation).

---

## SOUS-PROJET A — Membres & RBAC par organisation (Lot 6)

Design : `docs/plans/2026-07-08-membres-rbac-org-design.md` (20 décisions). Feature
`app/products/aiglebusiness/membership/`.

### Lot A — Fondation RBAC — commit `99acf72` — ✅ implémenté
Seed OWNER à la création d'org + 3 tables. Fichiers clés :
- `domain/permissions.config.ts` (catalogue 11 permissions, `sensitive`, `assertValidPermissions`)
- `domain/models/organisation_role.ts`, `organisation_role_permission.ts`, `organisation_member.ts`
- `domain/system_roles.ts`, `domain/enums/member_status.ts`
- `application/services/membership_service.ts` (`seedForNewOrganisation`)
- migrations batch 9 (`organisation_roles`, `_role_permissions`, `_members`)

### Lots C + B — Rôles éditables & Membres — commit `f810f21` — ✅ implémentés (livrés ensemble)
**Rôles (Lot C)** :
- `application/use_cases/roles/` : create / update / delete / list_roles / list_permissions_catalog
- `application/dtos/role.dto.ts`, `permission.dto.ts`
- `presentation/client/` : role_controller, permission_controller, validators/role_validators
- `infrastructure/repositories/organisation_role_repository_impl.ts` (étendu)
- `application/authorization/permission_helpers.ts` (`memberHasPermission`, filtre ACTIVE)

**Membres (Lot B)** :
- `application/use_cases/members/` : invite / resend_invitation / list_members / change_member_role /
  remove_member / get_invitation / accept_invitation / decline_invitation
- `application/services/invitation_service.ts` (token 48h + SMS lien)
- `application/dtos/member.dto.ts`
- `domain/exceptions/` (7 : member_already_exists, invitee_not_aigle_user, invitee_kyc_not_verified,
  invitation_token_invalid, invitation_expired, member_not_found, owner_member_immutable)
- `domain/templates/membership_consent_otp_template.ts`
- `infrastructure/repositories/organisation_member_repository_impl.ts` (étendu, `countActiveByRole`)
- `presentation/client/` : member_controller, invitation_controller, validators/member_validators
- migration batch 10 (`invitation_token` / `invitation_expires_at`)

**Anti-corruption produit→core (décision #18)** :
- `app/core/identity/user/application/services/user_directory_service.ts` + `dtos/user_lookup_result.ts`
- `app/core/identity/user/domain/interfaces/user_repository.ts` + impl (`findByIds`) — batch, fin du N+1
- règle depcruise `produit-consomme-core-par-service` (**error**, 0 violation)

**Points de vigilance à inspecter** :
- `permission_helpers.ts` : filtre `status = ACTIVE` (faille fermée)
- `delete_role.use_case.ts` : garde `countActiveByRole > 0` → 409
- `member.dto.ts` / use cases : plus aucun import de `UserRepository`/modèle `User`
- `organisation/application/merchant_qr.ts` : lit `aigleplayPortailUrl` via `config/app`

**Tests** : `role_management_flow.spec` (20), `member_management_flow.spec` (18), `organisation_flow` (adj.)
**Doc API** : `docs/swagger/business.yaml` (endpoints rôles + membres + invitations + 429)

### Sécurité — rate-limit anti-abus — commit `8710d53` — ✅
- `membership/presentation/client/throttles/membership_throttles.ts` (invite / resend / otp invitation)
- `core/identity/otp/presentation/throttles/otp_throttle.ts` (déplacé depuis `start/limiter.ts` supprimé)

### Dette soldée — commit `808aab6` — ✅
- `core/catalog/country/application/services/country_directory_service.ts` + `dtos/country_lookup_result.ts`
- `core/catalog/country/application/interfaces/country_cache.ts` + `infrastructure/services/country_cache_service.ts`
- `products/aiglesend/operations/application/services/recipient_locator.ts` (via service, plus le repo)
- règle depcruise promue en **error**

### Lot D — Enforcement RBAC — ⏸️ EN PAUSE (conçu, décisions #19/#20, **pas implémenté**)
Middleware `requirePermission` live + suppression des policies Bouncer. Suspendu au profit du socle auth.

---

## SOUS-PROJET B — Auth multi-app & gestion d'appareils

Design : `docs/plans/2026-07-08-auth-multi-app-device-design.md` (9 décisions, 3 lots).

### Design des 3 lots — commits `0d72f53`, `294d542`, `48b358d` — ✅ (design seul)

### Lot 1 (business) + Lot 2 (login business) — commit `d36c216` — ✅ implémentés
**Socle core (Lot 1)** :
- `core/identity/authentication/domain/enums/app_name.ts` (`AppName`, `appAbility`)
- `core/identity/authentication/application/services/issue_app_token_service.ts` (token stampé)
- `core/identity/authentication/application/services/pin_verification_service.ts` (PIN par userId)
- `core/identity/authentication/presentation/middleware/require_app_middleware.ts` (403/401)
- `start/kernel.ts` (named middleware `requireApp`)
- **Modifiés** (stamp `app:aiglesend`) : `verify_and_authenticate_user_account_use_case.ts`,
  `reset_password_use_case.ts`

**Login business (Lot 2)** — `app/products/aiglebusiness/auth/` :
- `application/use_cases/` : business_login (phone+PIN→OTP) / business_verify_login (OTP→token)
- `application/dtos/business_auth.dto.ts`
- `domain/exceptions/invalid_credentials_exception.ts`, `domain/templates/business_login_otp_template.ts`
- `presentation/client/` : business_auth_controller, validators, routes

**Cloisonnement appliqué** : `requireApp('aiglebusiness')` sur
`organisation/.../business_routes.ts` + `membership/.../membership_routes.ts` ; routes `auth/*` publiques.

**Points de vigilance à inspecter** :
- `issue_app_token_service.ts` : `issueForUser(User)` (core) vs `issue(userId)` (produit)
- `require_app_middleware.ts` : sémantique bonne app / autre app (403) / sans stamp (401)
- `business_login.use_case.ts` : PIN faux/inconnu → 401 générique (anti-énumération)
- invariant : la feature `auth` produit ne touche pas le modèle `User` (via services core)

**Tests** : `business_auth_flow.spec` (4), cloisonnement dans `role_management_flow.spec` (aiglesend→403,
sans stamp→401, business→200)

### Lot 1 (mobile) — ✅ implémenté
`requireApp('aiglesend')` posé sur les **9 groupes de routes mobiles authentifiés** (auth protégé,
device, kyc, debit_phone, profile, transaction, wallet, operation, qr). Routes publiques épargnées.
Test `tests/functional/auth/app_cloisonnement.spec.ts` (business→403, sans stamp→401, sans jeton→401).

### Lot 3 — Sessions révocables — ⏳ conçu, **pas implémenté**
« Mes sessions » = access tokens actifs, révocation `accessTokens.delete`, via service core.

---

## Invariants d'architecture (durs, depcruise `error`)
1. `core-ne-depend-pas-du-produit` — le core n'importe jamais un produit.
2. `produit-consomme-core-par-service` — un produit ne consomme le core que par service/DTO minimal,
   jamais repo/modèle/infra core.

## Reste global
1. **Lot 1 mobile** (symétrie cloisonnement) — auth multi-app.
2. **Lot 3** (sessions révocables) — auth multi-app.
3. **Lot D RBAC** (enforcement) — reprendre après le socle auth.
4. Reportés : tests admin auth pré-prod, KYB (QR entreprise à l'approbation), mass-payout.
