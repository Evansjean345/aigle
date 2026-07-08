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
| 3 | **Auth du portail web = phone + mot de passe** (réutilise l'identité core : `password` existe déjà sur `User`), **OTP en 2FA à la 1re connexion d'une nouvelle session/navigateur** (pas de SMS à chaque login). Le challenge OTP « nouvelle session » se branche sur le modèle sessions révocables (#2, Lot 3) | phone+OTP à chaque login (SMS coûteux/friction) ; email+mot de passe (email nullable → collecte/vérif, nouveau chemin identité) | Web-approprié, réutilise l'identité phone-centrique existante, l'OTP nouvelle session s'intègre aux sessions Lot 3 | 2026-07-08 |
| 4 | **Stamp = ability `app:<produit>` dans le token** (les abilities sont inutilisées aujourd'hui, aucun `.allows()`) ; `requireApp` lit `currentAccessToken.abilities` en **inclusion littérale**. **Transition = forcer le re-login** (enforce strict d'emblée, tokens sans stamp refusés). Sémantique middleware : bon `app` → passe ; **autre** `app:*` → **403** (cloisonnement) ; **aucun** `app:*` (legacy) → **401** (re-login) | backfill `app:aiglesend` + enforce (moins disruptif) ; grandfather les tokens sans stamp (faille transitoire) | Le plus propre ; abilities repurposables sans risque ; contexte pré-prod tolère la déconnexion | 2026-07-08 |

## Objectif (validé 2026-07-08)

Cloisonner l'authentification **par produit** (token stampé `app:<produit>` + middleware `requireApp`)
et gérer les appareils **par plateforme** (mobile = fingerprint existant, web = sessions révocables).
Réussi si : un token d'un produit ne peut rien sur l'autre, et un user web peut lister/révoquer ses
sessions.

## Découpage (validé 2026-07-08) — mode large

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| 1 — Cloisonnement & stamp | ability `app:<produit>` sur les tokens à l'émission + middleware `requireApp('...')` sur les groupes de routes (business exige `app:aiglebusiness`, mobile aiglesend exige `app:aiglesend`) | — | design en cours |
| 2 — Login business | entrée d'auth aiglebusiness réutilisant l'identité core, émettant un token `app:aiglebusiness` (web + mobile business) | 1 | à faire |
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

## Prochaine session

Lot 1 conçu. Prochain : concevoir le **Lot 2** (login business phone+password + OTP nouvelle session,
stamp `app:aiglebusiness`) puis le **Lot 3** (sessions web révocables `user_device platform=web`).
Le **Lot D** du RBAC (`docs/plans/2026-07-08-membres-rbac-org-design.md`) reste en pause jusqu'à la
livraison de ce socle auth.