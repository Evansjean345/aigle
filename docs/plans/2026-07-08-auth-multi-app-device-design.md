---
status: in-review
etape: 2
lot: "1"
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
| 2 | **Device selon la plateforme** : mobile (aiglesend + aiglebusiness mobile) = fingerprint + appareil de confiance (**existant**, réutilisé) ; **web business = sessions révocables** (`user_device` `platform=web` : sessionId + userAgent + IP + lastSeen), listables/révocables, multi-session autorisé, **sans** enforcement « un seul appareil » | pas de liaison appareil (web) ; fingerprint navigateur type mobile (instable/évadable) | Le fingerprint matériel est mobile-natif ; le web a besoin de « voir/déconnecter mes sessions » sans fausse sécurité de fingerprint navigateur | 2026-07-08 |
| 3 | ~~Auth du portail web = phone + mot de passe~~ **CORRIGÉ par #5** : hypothèse « `password` existe déjà » fausse (champ présent mais **jamais renseigné** — seul `pincode` l'est à l'inscription). L'idée « OTP nouvelle session » (2FA) est conservée par #5 | — | Le champ password est dormant/vide pour tous les users → un login password exigerait un onboarding « set password » | 2026-07-08 → révisé |
| 5 | **Auth du portail web = phone + PIN (`pincode`) + OTP en 2FA à la nouvelle session** : réutilise le credential existant (tous les users ont un `pincode`), **zéro onboarding**, un seul credential mobile+web. L'OTP « nouvelle session » compense la faiblesse du PIN et se branche sur les sessions révocables (#2, Lot 3) | password web (flux set-password + état « password non défini ») ; PIN maintenant / password plus tard (repoussé) | Débloque le web immédiatement sans nouveau chemin d'identité ; cohérent avec l'auth phone+PIN mobile existante | 2026-07-08 |
| 6 | **Lot 2 = OTP systématique** (login business `phone+PIN → OTP → token`, à chaque login comme mobile). Le « skip OTP pour navigateur connu » de #5 est **réalisé au Lot 3** (persistance de session) | embarquer la persistance de session dès le Lot 2 (lots moins nets) | Lot 2 livrable seul, sûr d'emblée ; frontière Lot 2/3 propre | 2026-07-08 |
| 7 | **Émission du token stampé = service CORE `IssueAppTokenService.issue(user, app)`** (encapsule `User.accessTokens.create(user, ['app:<name>'])`). Le produit business l'appelle sans toucher le modèle `User` ; aiglesend l'utilise aussi pour son stamp | émettre depuis le produit (toucherait le modèle User → viole produit→core) ; déléguer tout l'auth à un use case core (business = simple façade) | Respecte l'invariant `produit-consomme-core-par-service` ; réutilisable par les deux produits | 2026-07-08 |
| 4 | **Stamp = ability `app:<produit>` dans le token** (les abilities sont inutilisées aujourd'hui, aucun `.allows()`) ; `requireApp` lit `currentAccessToken.abilities` en **inclusion littérale**. **Transition = forcer le re-login** (enforce strict d'emblée, tokens sans stamp refusés). Sémantique middleware : bon `app` → passe ; **autre** `app:*` → **403** (cloisonnement) ; **aucun** `app:*` (legacy) → **401** (re-login) | backfill `app:aiglesend` + enforce (moins disruptif) ; grandfather les tokens sans stamp (faille transitoire) | Le plus propre ; abilities repurposables sans risque ; contexte pré-prod tolère la déconnexion | 2026-07-08 |

## Objectif (validé 2026-07-08)

Cloisonner l'authentification **par produit** (token stampé `app:<produit>` + middleware `requireApp`)
et gérer les appareils **par plateforme** (mobile = fingerprint existant, web = sessions révocables).
Réussi si : un token d'un produit ne peut rien sur l'autre, et un user web peut lister/révoquer ses
sessions.

## Découpage (validé 2026-07-08) — mode large

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| 1 — Cloisonnement & stamp | ability `app:<produit>` sur les tokens à l'émission + middleware `requireApp('...')` sur les groupes de routes (business exige `app:aiglebusiness`, mobile aiglesend exige `app:aiglesend`) | — | design fait |
| 2 — Login business | entrée d'auth aiglebusiness (phone+PIN+OTP, service core IssueAppToken), token `app:aiglebusiness` | 1 | design fait |
| 3 — Sessions web révocables | `user_device` `platform=web` (sessionId/userAgent/IP/lastSeen), endpoints « mes sessions actives » + révocation, liaison token↔session | 2 | à faire |

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

## Prochaine session

Lots 1-2 conçus. Prochain : concevoir le **Lot 3** (sessions web révocables `user_device platform=web`
+ skip-OTP navigateur connu, réalisant le « nouvelle session » de #5). Puis implémentation (Lot 1+2
ensemble car business a besoin du login pour que `requireApp('aiglebusiness')` soit utile), puis Lot 3,
puis **reprise du Lot D RBAC** (`docs/plans/2026-07-08-membres-rbac-org-design.md`).