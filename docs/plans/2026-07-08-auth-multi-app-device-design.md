---
status: approved
etape: 6
lot: "1-2"
derniere_maj: 2026-07-08
---

# Auth multi-app & gestion d'appareils — Design

Les deux produits (**aiglesend** mobile et **aiglebusiness** portail web) partagent la **même
authentification** (core identity, `tokensGuard`). Objectif : (1) distinguer de quelle app provient
une requête/token de façon fiable, et (2) définir un modèle de gestion d'appareils cohérent pour
mobile ET web. Prérequis posé avant de reprendre le **Lot D** (enforcement RBAC business).

## Contexte (exploré 2026-07-08)

**Auth partagée** : le token est un `User.accessTokens` opaque (guard `api`, `DbAccessTokensProvider`).
Le login crée le token avec des abilities (`['*']`). **Aucune** distinction d'app aujourd'hui : pas de
header `X-Client-App`, pas d'ability/scope marquant aiglesend vs aiglebusiness.

**Matrice des clients (3)** — deux dimensions à ne pas confondre :

| Produit | Clients | Dimension concernée |
|---------|---------|---------------------|
| aiglesend | mobile | — |
| aiglebusiness | mobile **+** portail web | device diffère mobile↔web |

- **Produit** (aiglesend / aiglebusiness) → accès & RBAC (endpoints business).
- **Plateforme** (mobile / web) → gestion d'appareils (fingerprint mobile vs navigateur web).
- Un **même `User`** peut relever des deux produits (user aiglesend qui est aussi membre d'une org
  business). La question du **cloisonnement des tokens** entre produits est donc réelle.

**Device (mobile uniquement)** :
- `DeviceMiddleware` (shared) lit les headers `X-Device-Fingerprint`, `X-Device-Uid`,
  `X-Device-Platform`, `X-App-Version`, `X-Device-Os-Version` → `ctx.deviceInfo`. Option `required`.
- Au login mobile : `deviceService.trustDevice(userId, fingerprintHash, deviceUid)` crée un
  `user_device`, et le **token est nommé `device:<userDevice.id>`** (liaison token↔appareil de confiance).
- Modèle `user_device` : porte notamment `platform`. Un « appareil de confiance » par utilisateur
  (sécurité mobile : PIN, blocage sur trop d'échecs, etc.).
- **Business (web)** : routes sous `middleware.auth()` **seulement** — **aucun** `middleware.device()`,
  aucune liaison appareil. Le web business n'a donc aujourd'hui aucune gestion d'appareil.

**Zones de risque / tension** :
- Le modèle « fingerprint + appareil de confiance unique » est **mobile-natif** ; il ne transpose pas
  tel quel à un navigateur (pas de fingerprint matériel stable, plusieurs sessions navigateur légitimes).
- Distinguer l'app par un header serait **spoofable** → inadapté à une décision de sécurité.
- Le core `identity` ne doit pas dépendre des produits (invariant `core-ne-depend-pas-du-produit`) :
  la notion d'« app » doit rester une donnée neutre côté core (ability/scope), pas un couplage produit.

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| 1 | **Token cloisonné par produit** : le login se fait « dans » un produit ; le token porte l'app (`app:aiglesend`/`app:aiglebusiness`) et un middleware `requireApp('...')` refuse un token du mauvais produit sur les endpoints de l'autre. Défense en profondeur **par-dessus** le RBAC | token transverse (un seul, accès selon droits) ; transverse + stamp indicatif | Un token aiglesend fuité ne peut RIEN sur `/business` (et inversement) ; permet des sessions/TTL/device **par produit** | 2026-07-08 |
| 2 | **Device selon la plateforme** : mobile (aiglesend + aiglebusiness mobile) = fingerprint + appareil de confiance (**existant**, réutilisé) ; **web business = sessions révocables** (mécanisme précisé par #8), listables/révocables, multi-session autorisé, **sans** enforcement « un seul appareil » | pas de liaison appareil (web) ; fingerprint navigateur type mobile (instable/évadable) | Le fingerprint matériel est mobile-natif ; le web a besoin de « voir/déconnecter mes sessions » sans fausse sécurité de fingerprint navigateur | 2026-07-08 |
| 3 | ~~Auth du portail web = phone + mot de passe~~ **CORRIGÉ par #5** : hypothèse « `password` existe déjà » fausse (champ présent mais **jamais renseigné** — seul `pincode` l'est à l'inscription). L'idée « OTP nouvelle session » (2FA) est conservée par #5 | — | Le champ password est dormant/vide pour tous les users → un login password exigerait un onboarding « set password » | 2026-07-08 → révisé |
| 5 | **Auth du portail web = phone + PIN (`pincode`) + OTP** : réutilise le credential existant (tous les users ont un `pincode`), **zéro onboarding**, un seul credential mobile+web. ~~OTP « nouvelle session »~~ → **OTP systématique** (#9). Le PIN faible est compensé par l'OTP à chaque login | password web (flux set-password + état « password non défini ») ; PIN maintenant / password plus tard | Débloque le web immédiatement sans nouveau chemin d'identité ; cohérent avec l'auth phone+PIN mobile existante | 2026-07-08 (OTP systématique par #9) |
| 6 | **Lot 2 = OTP systématique** (login business `phone+PIN → OTP → token`, à chaque login comme mobile). ~~Le skip OTP pour navigateur connu réalisé au Lot 3~~ **ABANDONNÉ par #9** : l'OTP reste systématique (sécurité) | embarquer la persistance de session dès le Lot 2 | Lot 2 livrable seul, sûr d'emblée | 2026-07-08 (skip retiré par #9) |
| 7 | **Émission du token stampé = service CORE `IssueAppTokenService.issue(user, app)`** (encapsule `User.accessTokens.create(user, ['app:<name>'])`). Le produit business l'appelle sans toucher le modèle `User` ; aiglesend l'utilise aussi pour son stamp | émettre depuis le produit (toucherait le modèle User → viole produit→core) ; déléguer tout l'auth à un use case core (business = simple façade) | Respecte l'invariant `produit-consomme-core-par-service` ; réutilisable par les deux produits | 2026-07-08 |
| 8 | **Session web = le token lui-même** (pas de nouvelle table, précise #2). « Mes sessions » = lister les access tokens actifs du user (nom = navigateur, `deviceInfo` json = userAgent+IP, `last_used_at`, `created_at`) ; révoquer = `accessTokens.delete`. Exposé via un service core (le produit ne touche pas le modèle User) | `UserDevice` + `Device` synthétique (pollue Device de fingerprints factices) ; table `web_session` dédiée (duplique listing/révocation) | Naturel pour le web (token=session), zéro table, révocation native ; `access_tokens` porte déjà name/deviceInfo/last_used_at | 2026-07-08 |
| 9 | **OTP SYSTÉMATIQUE au login web, pas de skip « navigateur connu »** (révise #5/#6) : sauter l'OTP sur un portail **financier** = faille. Le remember-token navigateur est **abandonné** (pas reporté). Le Lot 3 se réduit donc à **lister/révoquer les sessions** | inclure le skip-OTP (remember-token) ; le reporter à un Lot 4 | Sécurité d'une appli financière : l'OTP à chaque login web est la bonne posture, pas une friction à supprimer | 2026-07-08 |
| 4 | **Stamp = ability `app:<produit>` dans le token** (les abilities sont inutilisées aujourd'hui, aucun `.allows()`) ; `requireApp` lit `currentAccessToken.abilities` en **inclusion littérale**. **Transition = forcer le re-login** (enforce strict d'emblée, tokens sans stamp refusés). Sémantique middleware : bon `app` → passe ; **autre** `app:*` → **403** (cloisonnement) ; **aucun** `app:*` (legacy) → **401** (re-login) | backfill `app:aiglesend` + enforce (moins disruptif) ; grandfather les tokens sans stamp (faille transitoire) | Le plus propre ; abilities repurposables sans risque ; contexte pré-prod tolère la déconnexion | 2026-07-08 |
| 10 | **Device trust pour aiglebusiness MOBILE** (comme aiglesend), **web business garde les sessions Lot 3** (précise #2). Le login business (étape verify) accepte un `deviceInfo` **optionnel** ; s'il est présent → `saveDevice` + `trustDevice` scopés `app='aiglebusiness'`. Trou comblé : le login business (Lot 2) ne trustait aucun appareil | web business aussi en device (pas de fingerprint navigateur, #2) | Cohérent avec « device par plateforme » (#2) ; le mobile business est un vrai appareil de confiance | 2026-07-09 |
| 11 | **Distinction d'app = colonne `app` sur `user_devices`** (le LIEN), **pas** sur `devices` (le matériel, app-agnostique — même téléphone, 2 apps). **Un `user_device` par (user, device, app)**. `DeviceService` + repo deviennent **app-scoped** (`findActiveByUserAndDeviceAndApp`, `countActiveByUserIdAndApp`) ; les appelants aiglesend passent `app='aiglesend'` | colonne sur `devices` (matériel ≠ app) ; 1 lien multi-app (set d'apps) | Le matériel est partagé, le lien de confiance est par-app ; même téléphone trusté indépendamment par app | 2026-07-09 |
| 12 | **Quota (`MAX_DEVICE_CONNECTIONS`), `is_primary` et lookups = PAR-APP** (aujourd'hui globaux). Backfill : les `user_devices` existants → `app='aiglesend'` (tout le device trust actuel est aiglesend, business n'avait pas de flux device) | quota global (un login business pourrait évincer un appareil aiglesend) | Les contextes sont indépendants : N appareils de confiance aiglesend ET N aiglebusiness ; primary par app | 2026-07-09 |
| 13 | **Canal explicite (`mobile`/`web`) déclaré par le client** via header `X-Client-Channel`, **obligatoire** au verify business (400 sinon). Enum `ClientChannel` neutre en **core** (comme `AppName`) | canal inféré serveur (présence device) ; header purement indicatif | Distinction de canal explicite et fiable pour la policy device + futures restrictions ; core neutre héberge l'enum (pas de dépendance vers business) | 2026-07-09 |
| 14 | **Middleware device PROPRE au business** (`aiglebusiness/auth/presentation/client/middleware/business_device_middleware`), séparé de celui d'aiglesend (mobile-only, inchangé) : lit le canal et **exige l'appareil selon le canal** (`mobile` → headers device requis 400 sinon ; `web` → non). Cf. [[feature-scoped-presentation-concerns]] | rendre le device middleware shared channel-aware (mélange aiglesend/business) | aiglesend n'a pas de canaux ; le concern channel-aware est business → son propre middleware | 2026-07-09 |
| 15 | **Canal stampé sur le token** (`channel:<name>`, comme `app:`) via `IssueAppTokenService` (option générique, core neutre) → exposé dans « mes sessions » (`UserSessionResult.channel`) et socle des futures restrictions (`requireChannel`) | canal en métadonnée seulement (non queryable) | Source de vérité serveur du canal de la session ; extensible (policy par canal) | 2026-07-09 |

## Objectif (validé 2026-07-08)

Cloisonner l'authentification **par produit** (token stampé `app:<produit>` + middleware `requireApp`)
et gérer les appareils **par plateforme** (mobile = fingerprint existant, web = sessions révocables).
Réussi si : un token d'un produit ne peut rien sur l'autre, et un user web peut lister/révoquer ses
sessions.

## Découpage (validé 2026-07-08) — mode large

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| 1 — Cloisonnement & stamp | ability `app:<produit>` sur les tokens à l'émission + middleware `requireApp('...')` sur les groupes de routes (business exige `app:aiglebusiness`, mobile aiglesend exige `app:aiglesend`) | — | **implémenté** (business + mobile) |
| 2 — Login business | entrée d'auth aiglebusiness (phone+PIN+OTP, service core IssueAppToken), token `app:aiglebusiness` | 1 | design fait |
| 3 — Sessions révocables | « mes sessions » = access tokens actifs (name/last_used_at) + révocation (`accessTokens.delete`), via service core. **Sans** skip-OTP (#9) | 2 | **implémenté** |

## Inconnues

- ~~Transition/rétrocompat des tokens~~ **TRANCHÉ (#4)** : forcer le re-login (enforce strict).
- ~~Mécanisme d'auth du portail web~~ **TRANCHÉ (#3)** : phone + mot de passe + OTP nouvelle session.
- Réutilisation exacte du flow device mobile par l'app **business mobile** → **Lot 2/3**.

## Lot 1 — Design (cloisonnement & stamp)

**Architecture** (décision #4) :
- **Stamp à l'émission** : les use cases qui créent un token (login/verify aiglesend) posent l'ability
  `app:aiglesend` ; le login business (Lot 2) posera `app:aiglebusiness`. Remplace le `['*']` décoratif.
- **Middleware `requireApp(app: 'aiglesend' | 'aiglebusiness')`** — core identity auth, paramétré. Lit
  `ctx.auth.user.currentAccessToken.abilities` : contient `app:<attendu>` → `next()` ; contient un
  **autre** `app:*` → **403** ; **aucun** `app:*` → **401** (re-login). Appliqué sur les groupes de
  routes : `/business/*` → `requireApp('aiglebusiness')`, mobile aiglesend → `requireApp('aiglesend')`.
- **Neutralité core** : le core stampe une chaîne `app:<name>` neutre — aucun import produit
  (invariant `core-ne-depend-pas-du-produit` préservé).

**Impact** : modifier les créations de token aiglesend (ajouter le stamp) ; monter `requireApp` sur les
groupes ; pas de migration (transition = re-login #4). Les tokens en base deviennent invalides pour les
routes gardées → re-login.

**Tests** : token stampé `aiglesend` sur `/business` → 403 ; token sans stamp → 401 ; token `aiglesend`
sur route aiglesend → 200. (Le login business viendra au Lot 2 pour le cas `aiglebusiness` → 200.)

## Lot 2 — Design (login business)

**Flux** (2 étapes, réutilise l'identité core, décisions #5/#6/#7) :
1. `POST /business/auth/login` `{country_id, phone, pincode}` → valide le PIN (service core
   `verify-credentials` / `PinAttemptGuard`), envoie l'OTP (`OtpSendingService`). Réponse : « OTP envoyé ».
2. `POST /business/auth/verify` `{country_id, phone, otp}` → vérifie l'OTP (`OtpVerificationService`),
   émet le token stampé via **`IssueAppTokenService.issue(user, 'aiglebusiness')`**, renvoie profil + token.

**Architecture** :
- **Core** : nouveau `IssueAppTokenService` (`core/identity/authentication/application/services/`) —
  `issue(user, app: 'aiglesend' | 'aiglebusiness')` → `User.accessTokens.create(user, ['app:'+app])`.
  Refactor : les créations de token aiglesend passent par ce service avec `'aiglesend'` (stamp Lot 1).
- **Produit business** : `aiglebusiness/auth/presentation/client/` (controllers login/verify + validators
  Vine + routes montées dans `start/routes`, canal client = web+mobile business). Le use case business
  orchestre les services core (PIN, OTP, IssueAppToken) via ports — jamais les repos/modèles core.
- **`requireApp('aiglebusiness')`** (Lot 1) monté sur les groupes business protégés **après** que ce
  login existe (sinon `/business/*` inaccessible). Les routes `auth/login` + `auth/verify` sont
  **publiques** (pas de token encore).

**Impact** : refactor des émissions de token aiglesend (→ `IssueAppTokenService`, stamp `aiglesend`) ;
pas de migration ; pas de nouveau credential (PIN existant). Le login mobile core reste inchangé
fonctionnellement (juste le stamp ajouté).

**Tests** : login business PIN valide → OTP envoyé ; PIN invalide → rejet ; verify OTP correct → token
**stampé `app:aiglebusiness`** ; OTP faux → rejet ; token business → passe `requireApp('aiglebusiness')` ;
token aiglesend → 403 sur `/business` ; token business → 403 sur une route `requireApp('aiglesend')`.

## Lot 3 — Design (sessions révocables)

Périmètre réduit par #9 (pas de skip-OTP) : **lister et révoquer** les sessions actives d'un user, la
session étant l'access token lui-même (#8).

**Architecture** :
- **Core** : étendre l'auth d'un service `UserSessionService` (`core/identity/authentication/application/`)
  exposant `listActive(userId) → UserSessionResult[]` et `revoke(userId, tokenId)`. Il lit les access
  tokens du user (via `User.accessTokens` / la table), mappe vers un DTO minimal
  `UserSessionResult {id, name, userAgent, ip, platform, lastUsedAt, createdAt, current}`, et supprime
  un token par id (en vérifiant qu'il appartient bien au user). Le flag `current` marque la session
  courante (`ctx.auth.user.currentAccessToken.identifier`).
- **Enrichissement à l'émission** : `IssueAppTokenService` (Lot 2) renseigne `name` (libellé navigateur)
  et `deviceInfo` json (userAgent + IP) sur le token, à partir des infos requête, pour un listing utile.
- **Produit business** : `aiglebusiness/auth/presentation/client/` — `GET /business/auth/sessions`
  (liste) et `DELETE /business/auth/sessions/:id` (révoque), gardés par `middleware.auth()` +
  `requireApp('aiglebusiness')`. Le produit passe par `UserSessionService` (jamais le modèle User).
- **Transverse** : le service étant core, aiglesend mobile peut aussi exposer ses sessions plus tard
  (hors périmètre ici).

**Flux** : `GET sessions` → liste (la courante marquée) ; `DELETE sessions/:id` → révoque un autre
token (déconnecte ce navigateur) ; révoquer la session courante = logout classique (déjà existant).

**Impact** : aucun schéma nouveau (le token porte déjà name/deviceInfo/last_used_at). Ajout d'un service
core + 2 endpoints business. `IssueAppTokenService` gagne le remplissage name/deviceInfo.

**Tests** : login business 2 fois (2 tokens) → `GET sessions` renvoie 2 entrées, la courante flaggée ;
`DELETE sessions/:autreId` → le 2e token ne fonctionne plus (401) ; révoquer un token d'un **autre**
user → 404/403 (ownership) ; le listing n'expose pas le hash du token.

## Risques & inconnues — RÉSOLUES à l'implémentation

- **⚠️ Ajustement de #8** : le `DbAccessTokensProvider` standard **n'accepte que `{name, expiresIn}`** à
  `create` et `all()` ne renvoie **pas** de `deviceInfo`. Le `UserSessionResult` implémenté est donc
  `{id, name, lastUsedAt, createdAt, current}` — **pas** de champ `ip`/`platform`/`deviceInfo` séparé
  (aurait exigé un provider custom, disproportionné). Le **`name`** porte déjà le label utile
  (`device:<id>` en mobile, user-agent en web via `sessionName` du Lot 2). Session = token, listable/
  révocable : l'esprit de #8 est tenu.
- **IP/userAgent** : le login business remplit déjà `name` = user-agent (Lot 2). L'IP séparée est
  abandonnée avec l'ajustement ci-dessus.

## Lot 3 — IMPLÉMENTÉ ✅

- **Core** : `UserSessionService` (`listActive(userId, currentTokenId)` / `revoke(userId, tokenId,
  currentTokenId)`) + DTO `UserSessionResult` + exception `SessionNotFoundException` (404, ownership).
- **Business** : use cases `ListBusinessSessions`/`RevokeBusinessSession` (délèguent au service core,
  invariant produit→core respecté) + `BusinessSessionController` + routes `GET/DELETE
  /business/auth/sessions[/:id]` (groupe authentifié `auth` + `requireApp('aiglebusiness')`).
- **Tests** `business_sessions_flow.spec` (5) : liste (courante marquée), révocation (token révoqué →
  401, la liste décroît), ownership (token d'autrui → 404), sans jeton → 401, cloisonnement aiglesend → 403.
- Vérifs : tsc/eslint/depcruise clean (0 error), suite 250/254 (4 core pré-existants).

## Extension : device trust mobile business (décisions #10-#12) — IMPLÉMENTÉ ✅

- **Schéma** : colonne `app` sur `user_devices` (migration ; défaut `aiglesend` → backfill auto).
  `devices` (matériel) inchangé. **Un `user_device` par (user, device, app)**.
- **Core device app-scoped** : `DeviceService.saveDevice(…, app)` / `trustDevice(…, app)` ; quota
  (`MAX_DEVICE_CONNECTIONS`), `is_primary` et lookups **par app** ; les appelants aiglesend
  (register, verify-account, verify-credentials, revoke, push) passent `AIGLESEND`.
- **API produit** `DeviceService.registerAndTrustForApp(deviceRequest, userId, app)` → renvoie un
  **DTO minimal `{ userDeviceId }`** (pas le modèle `UserDevice`) → invariant produit→core tenu.
- **Login mobile business = DEUX temps** (comme aiglesend) : appareil complet dans le **BODY** à
  l'étape **login** (PIN, `device_info`) → `registerForApp` (**PENDING** + alerte « nouvel appareil ») ;
  à l'étape **verify** (OTP) l'appareil passe par les **HEADERS** device (`X-Device-Fingerprint`,
  `X-Device-Uid`, via `middleware.device({required:false})`) → `trustForApp` (**TRUSTED**), token
  `device:<id>`. Persistance jamais à la saisie du numéro. Web (sans device) inchangé (sessions Lot 3).
  Cohérent avec aiglesend : `verify-credentials` device en body, `verify-account` device en headers.
- **API produit** : `DeviceService.registerForApp` (void) + `trustForApp` (→ `{ userDeviceId }`) —
  deux méthodes qui ne fuient pas le modèle `UserDevice` (invariant produit→core).
- **Tests** : `device_service.spec` (trust app-aware + isolation par-app : même user+device, 2 apps →
  2 liens) ; `business_device_flow.spec` (login→PENDING, verify→TRUSTED ; device au login seul → reste
  PENDING ; web sans device → 0 lien). Suite 254/258 (4 core pré-existants), depcruise 0 error.

## Prochaine session

Design des 3 lots **complet**. Prochain : **implémenter Lot 1+2 ensemble** (business a besoin du login
pour que `requireApp('aiglebusiness')` soit utile ; stamp aiglesend + `requireApp('aiglesend')` en même
temps), puis **Lot 3** (sessions), puis **reprise du Lot D RBAC**
(`docs/plans/2026-07-08-membres-rbac-org-design.md`). Passer ce doc en `approved` avant d'implémenter.