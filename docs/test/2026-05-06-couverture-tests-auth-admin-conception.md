# Stratégie de couverture de tests — API AigleSend

**Date :** 2026-05-06
**Périmètre :** Définir la stratégie de tests pour l'ensemble de l'API et démarrer par la surface **authentification administrateur**.
**Statut :** Conception validée. Le plan d'implémentation suit (voir `writing-plans`).

---

## Contexte

AigleSend est une API AdonisJS v6 fintech qui suit une architecture DDD pragmatique (Domain / Application / Infrastructure / Presentation). La couverture de tests existante est faible : ~10 specs (KYC, pin guard, security alert detector, notifications, payments-flow avec mocks). La majorité de la logique métier n'est pas testée.

L'utilisateur a séquencé le travail comme suit :

1. **Maintenant :** déploiement manuel.
2. **Ensuite (ce plan) :** augmenter la couverture de tests sur toute l'application, en commençant par l'auth admin.
3. **Puis :** mettre en place la pipeline GitHub Actions.

Construire la CI avant les tests créerait une fausse confiance — des pipelines verts qui ne valident en réalité rien de la logique métier. La pipeline attendra donc.

L'ordre des surfaces à couvrir, acté en amont :

1. Authentification administrateur (cible de cette conception).
2. Moteur de paiement.
3. Refunds & wallet adjustments.
4. Audit & RBAC admin.
5. Catalogs.

---

## Décisions

Cinq décisions structurantes, chacune choisie après évaluation de 3 options :

| # | Décision | Choix |
|---|----------|-------|
| 1 | Niveau de test par surface | Mix par couche : **unit** pour la logique pure (guards, classifiers), **functional** pour l'orchestration (use cases, services qui touchent DB/Redis/emitter) |
| 2 | Point d'entrée des tests functional | Mix : **use case direct** par défaut (`app.container.make`), plus **1-3 tests HTTP par controller** pour le RBAC + middleware d'auth + rate-limit |
| 3 | Dépendances externes en functional | **Fakes Adonis built-in** (`mail.fake()`, `hash.fake()`, `emitter.fake()`) ; Redis et MySQL réels ; bcrypt réel uniquement dans les tests qui valident explicitement le hashing |
| 4 | Définition du « done » par surface | Hybride : **checklist mécanique par fichier** (happy path, exceptions, branches) + **règles métier transversales** par feature |
| 5 | Ordre d'attaque dans une surface | **Bottom-up** — guards (unit) → service (functional) → use cases (functional) → HTTP (full stack) |

---

## Architecture & layout

### Arborescence

```
tests/
├── bootstrap.ts                            # étendu : pose des fakes par test pour la suite functional
├── helpers/                                # NOUVEAU
│   ├── fakes.ts
│   ├── db.ts                               # withRollbackTransaction(group)
│   └── fixtures/
│       ├── admin.ts                        # createAdmin({...})
│       └── role.ts                         # createRole({...})
├── unit/
│   └── authentication/
│       ├── pin_attempt_guard.spec.ts       # existant
│       ├── admin_attempt_guard.spec.ts     # NOUVEAU
│       └── admin_otp_attempt_guard.spec.ts # NOUVEAU
└── functional/
    └── authentication/
        └── admin/
            ├── admin_auth_service.spec.ts          # NOUVEAU (bcrypt réel, vérifs de status)
            ├── admin_login_use_case.spec.ts        # NOUVEAU
            ├── verify_admin_otp_use_case.spec.ts   # NOUVEAU
            ├── setup_admin_password_use_case.spec.ts # NOUVEAU
            ├── admin_refresh_token_use_case.spec.ts  # NOUVEAU
            └── admin_routes_http.spec.ts           # NOUVEAU (RBAC, 401/403, rate-limit, 1 happy path)
```

### Conventions

- Fichier : `<sut_name>.spec.ts`. Pas de `.test.ts`, pas de `__tests__/`.
- Un `test.group()` par méthode publique du SUT.
- Noms de tests en **anglais**, présent simple ("throws X when Y", "rejects when Z"). Les nouveaux fichiers standardisent sur l'anglais pour mettre fin au mélange FR/EN actuel.
- Helpers locaux par fichier : `buildXxxStub()`, `makeXxx()`. Pas de `beforeEach` partagés sauf nécessité absolue.
- Suites et timeouts inchangés dans `adonisrc.ts` : `unit` 2s, `functional` 30s.

### Modifications de `bootstrap.ts`

`tests/bootstrap.ts` reçoit un hook `setup` par test (suite functional uniquement) qui pose et restaure `mail.fake()`, `hash.fake()`, `emitter.fake()`. Les specs qui ont besoin du vrai bcrypt appellent `hash.restore()` dans leur `group.setup`.

---

## Helpers

### `tests/helpers/db.ts`

```ts
export function withRollbackTransaction(group)
```

Encapsule `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` avec `SET FOREIGN_KEY_CHECKS = 0/1` (MySQL). DRY le pattern déjà utilisé dans `http_error_flow.spec.ts`.

### `tests/helpers/fixtures/admin.ts` et `role.ts`

`createAdmin(overrides)` et `createRole(overrides)` — source unique de vérité pour les fixtures admin/rôle. Évite que chaque spec dérive vers son propre schéma légèrement différent.

### Stubs unit

Aucun changement à la convention existante : `buildXxxStub()` faits-main typés via `as unknown as Interface`. Aucune bibliothèque de mocking introduite.

---

## Hors scope

- Tests de performance / charge.
- Tests d'Adonis lui-même (mécanique du bouncer, du mailer, du rate-limiter).
- Tests par propriété aléatoire (fuzzing).
- Tests de migration de schéma (sujet séparé).
- Tests browser / Playwright sur l'admin panel (suite non configurée).
- Assertions sur le format des logs (sauf si le log *est* un contrat — dans ce cas on teste l'event audit, pas la string du log).
- Seuil de couverture (`c8 --check-coverage`).
- Tests anti-régression historiques par bug (les règles vont dans la checklist transversale ; les tests bug-only sont du bruit).
- Tests qui appellent des services externes réels (Wave, Orange Money, vrai SMTP).
- Helpers « magiques » (décorateurs, runner global custom).

### Règles d'écriture auto-imposées

1. Un test avec une seule assertion qui ne fait que répéter son entrée est suspect — supprimer ou réécrire.
2. Pas de `test.skip` en commit.
3. Pas de tests générés en masse par IA sans relecture règle-par-règle. Chaque test correspond à une règle métier consciente.
4. Si toucher un use case en couche 3 révèle un cas manquant dans un guard de couche 1/2, on ajoute le test de couche 1/2 avant de continuer.

---

## Plan d'attaque — auth admin

Bottom-up. Chaque entrée peut être une PR distincte ; on peut grouper les petits fichiers.

### Couche 1 — Guards (unit)

| Fichier | SUT | Estimation |
|---------|-----|------------|
| `tests/unit/authentication/admin_attempt_guard.spec.ts` | `admin_attempt_guard.ts` | 8-12 tests |
| `tests/unit/authentication/admin_otp_attempt_guard.spec.ts` | `admin_otp_attempt_guard.ts` | 5-8 tests |

Pattern de référence : `pin_attempt_guard.spec.ts`.

### Couche 2 — Service (functional, bcrypt réel)

| Fichier | SUT | Estimation |
|---------|-----|------------|
| `tests/functional/authentication/admin/admin_auth_service.spec.ts` | `admin_auth_service.ts` (`verifyCredentialsForChallenge` et apparentés) | 6-9 tests |

Seul spec où `hash.restore()` est appelé dans `group.setup` pour valider la comparaison bcrypt réelle.

### Couche 3 — Use cases (functional, fakes mail/emitter)

| Fichier | SUT | Estimation |
|---------|-----|------------|
| `tests/functional/authentication/admin/admin_login_use_case.spec.ts` | `admin_login_use_case.ts` | 4-6 tests |
| `tests/functional/authentication/admin/verify_admin_otp_use_case.spec.ts` | `verify_admin_otp_use_case.ts` | 5-7 tests |
| `tests/functional/authentication/admin/setup_admin_password_use_case.spec.ts` | `setup_admin_password_use_case.ts` | 4-6 tests |
| `tests/functional/authentication/admin/admin_refresh_token_use_case.spec.ts` | `admin_refresh_token_use_case.ts` | 4-5 tests |

### Couche 4 — HTTP (functional via apiClient, full stack)

| Fichier | Surface | Estimation |
|---------|---------|------------|
| `tests/functional/authentication/admin/admin_routes_http.spec.ts` | RBAC, 401/403, rate-limiter, 1 happy `login → verify_otp` | 6-10 tests |

### Estimation d'effort

| Couche | Fichiers | Tests | Jours |
|--------|----------|-------|-------|
| 1 — Guards (unit) | 2 | 13-20 | 0.5-1 |
| 2 — Service (func + bcrypt) | 1 | 6-9 | 0.5 |
| 3 — Use cases (func + fakes) | 4 | 17-24 | 1.5-2 |
| 4 — HTTP (full stack) | 1 | 6-10 | 0.5-1 |
| **Total** | **8** | **42-63** | **3-4.5** |

---

## Définition du « done » — auth admin

### Par fichier (mécanique)

- Tous les tests passent (`npm test`).
- Au moins 1 happy path par méthode publique du SUT.
- Chaque exception levée par le SUT est déclenchée par au moins 1 test.
- Chaque branche conditionnelle non-triviale a 1 test (on teste la *règle*, pas le `if`).
- Aucun `test.skip`, aucun `console.log` traînant, aucun `// TODO: cover X`.
- Le fichier suit les conventions ci-dessus.

### Règles métier transversales — auth admin

À valider *quelque part* dans la suite, et à cocher dans la PR de clôture.

**Sécurité du flow 2FA**
- Aucun token (access/refresh) n'est jamais émis à l'étape 1 (login pré-OTP), même en happy path.
- Un OTP rejeté n'émet jamais de token, quelle que soit la raison.
- Un mot de passe valide + admin BLOCKED n'envoie pas de mail OTP (anti-spam, anti-info-leak).
- La réponse d'un login avec email inconnu est indistinguable d'un login avec mauvais mot de passe (anti-enumeration).

**Limites & rate-limiting**
- Le rate-limiter Adonis sur `/admin/auth/login` se déclenche au seuil configuré (test HTTP).
- `admin_attempt_guard` bloque temporairement après N échecs consécutifs.
- `admin_otp_attempt_guard` bloque indépendamment de `admin_attempt_guard`.

**Audit & traçabilité**
- Chaque tentative de login admin (succès ou échec) émet `activity:audit` avec `actorId`, `actorType: 'Admin'`, `ipAddress`, `result`.
- Un échec d'émission d'audit (`emitter.emit().catch()`) ne fait jamais échouer le use case parent.

**RBAC**
- Aucun endpoint admin sensible n'est accessible sans token admin (HTTP `401`).
- Aucun endpoint admin sensible n'est accessible avec un token user mobile (HTTP `403`).
- Au moins une route gardée par `bouncer` est testée avec un admin sans le rôle requis (HTTP `403`).

**Robustesse infra**
- Redis down (compteur jette) : aucun guard n'empêche un admin légitime de se connecter (fail-open documenté).
- Échec d'envoi du mail OTP : `admin_login_use_case` remonte une exception explicite (pas de cul-de-sac silencieux).

### Critère global

L'auth admin est **done** quand :

1. Toutes les cases mécaniques par fichier sont cochées.
2. Toutes les règles transversales sont cochées, chacune avec une référence `fichier:ligne` dans la PR de clôture.
3. Aucun test flaky observé sur 3 runs consécutifs locaux de `npm test`.

À ce moment-là : on enregistre dans memory que `auth admin = couvert`, on passe à la surface 2 (moteur de paiement).
