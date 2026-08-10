---
status: livré
# Constaté le 2026-08-05 : la feature `core/money/checkout` est en place (initiation et statut).
etape: 6
lot: -
derniere_maj: 2026-07-25
---

# Checkout aiglepay via deep link dans l'app aiglesend

Ouvrir l'app **aiglesend** depuis un lien (deep link / universal link) porté par le checkout
**aiglepay** d'un marchand, pour que le payeur règle le checkout **depuis son wallet aiglesend**.

**Mode** : Moyen-à-Large (app mobile Expo : deep linking + flux de paiement ; potentiellement le
frontend aiglepay et/ou le backend). À découper si Large.

## Contexte  *(exploré 2026-07-24)*
- **App mobile** : `apps/aiglesend/mobile/aiglesend` (Expo Router). Scheme **`aiglesend://`** ;
  universal links **`https://aigle-send.expo.app`** (iOS `associatedDomains` + Android
  `intentFilters`, `app.config.ts`). Handling deep link ponctuel existant (notifs, update-screen).
- **Flux pay-merchant in-app EXISTE** : route `app/(dashboard)/(pay-merchant)/index.tsx`, prend un
  `code` en param (`usePayMerchant(code)`), résout le marchand puis paie **depuis le wallet**
  (backend `pay_merchant.use_case` → `engine.moveInternal`, interne, **sans frais**). Entrée
  actuelle = **scan QR** (`scanne.tsx`).
- **Checkout public (aiglepay) EXISTE** (backend, ce repo) : `GET /api/checkout/payment-options`,
  `POST /api/checkout/:code` (`initiateCheckout` → mobile money, async PENDING),
  `GET /api/checkout/:reference/status`. Documenté dans `docs/swagger/business.yaml` (tag
  « Paiement marchand »). Rendu web = **page aiglepay** (portail public, payeur **non-aiglesend**).
- **`code` UNIFIÉ** = le **code d'alias payable** du marchand (`payable_alias`). Le MÊME code sert
  au scan in-app ET au checkout web.
- **Backend** : `mobileDeviceDeepLink` (`env MOBILE_DEVICE_DEEP_LINK_URL`) déjà utilisé comme
  success/error url des dépôts (providers synchrones).

**Hypothèse de travail** : le deep link est un **nouveau point d'entrée** vers le flux pay-merchant
existant — le `code` (alias) arrive par le lien plutôt que par un scan → paiement depuis le wallet.
À confirmer/raffiner en étape 2.

## Décisions
| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| D1 | Le deep link checkout **route vers le flux pay-merchant existant** → paiement **depuis le wallet** aiglesend (interne, sans frais). Le lien porte le `code` alias. | Mobile money in-app ; les deux | Réutilise tout l'existant (pay_merchant), différenciateur « payer un marchand avec ton solde ». | 2026-07-24 |
| D2 | **Réutiliser l'universal link Expo existant** `aigle-send.expo.app` (déjà revendiqué : iOS `applinks:` + Android `intentFilters autoVerify`, + build web `output:server` en fallback). Pas de nouveau domaine ni AASA. | Nouveau domaine dédié ; scheme custom `aiglesend://` seul | Déjà en place (utilisé post-paiement via `/confirm-by-provider`) ; fallback web natif du même codebase. | 2026-07-24 |

| D3 | **Deep link différé** : sans session, l'app **mémorise le `code`** (pending), fait login/déverrouillage, puis **reprend automatiquement** vers l'écran pay-merchant pré-rempli. | Login→accueil (code perdu) ; session requise sinon rien | Meilleure UX ; ne pas perdre l'intention de paiement à travers l'auth/lock/cold-start. | 2026-07-24 |

| D4 | **NE PAS toucher la prod** `aigle-send.expo.app` (domaine des redirections post-paiement existantes). Dev/test sur un **déploiement EAS Hosting de dev** + build **APP_VARIANT=development** (bundle ID distinct) revendiquant un **domaine dev**. Prod inchangée jusqu'à la release. | Développer directement sur le domaine prod | Risque de casser les redirections post-paiement en prod. | 2026-07-24 |
| D5 | **Pas de tests automatisés** (unit/intégration) pour ce lot. Vérification **manuelle** sur déploiement dev. | Tests unitaires du store / e2e | Choix produit « pour l'instant ». | 2026-07-24 |
| D6 | **Domaine dev** = alias EAS Hosting **`aigle-send--dev.expo.app`** (double tiret), **partagé dev+preview**. `app.config.ts` : `APPLINK_HOST` selon `APP_VARIANT` (prod inchangé). `.well-known` custom **injectés** dans `dist/client` post-export via `scripts/inject-dev-applinks.mjs` (assetlinks `com.aigle.aiglesend.dev` + keystore dev `B7:95:DB…` ; AASA appID dev) — **l'injection écrase l'auto-gen EAS** (vérifié). Prod = auto-gen intacte (jamais injectée). | Domaine dédié séparé ; toucher l'auto-gen prod ; `public/.well-known` commité (fuiterait en prod) | Prod 100 % isolée ; un seul domaine non-prod à maintenir. | 2026-07-25 |
| D7 | **Aiguilleur — cas verrouillé (sécurité)** : quand `isLocked`, on ne fait **jamais** `router.replace('/')` (bypasse le verrou car `AppBootConfig.hasNavigatedToLock` est armé → ne re-pousse pas le lock). On mémorise le code puis `dismissAll()` + `push('/lock-screen')` → **UN SEUL** lock-screen au-dessus du dashboard (sinon 2 lock-screens empilés → déverrouillages en cascade qui clobberent la reprise). Reprise (B4) gatée sur `wallet !== null` (dashboard chargé) ; navigation via `navigate` (garde le dashboard comme ancre). Retour post-paiement = `dismissAll()` + `replace('/(dashboard)')` (comme transfert), sinon `replace` seul reste piégé dans le groupe `(pay-merchant)`. | `replace('/')` (bypass verrou) ; `replace('/lock-screen')` (2 lock-screens) ; `push` reprise (dashboard dupliqué) ; `replace` seul post-paiement (piégé dans le groupe) | Verrou jamais contournable ; un seul déverrouillage ; retour dashboard fiable. | 2026-07-25 |

**Contexte routing (Expo Router)** : les groupes `(dashboard)`, `(pay-merchant)`… sont **transparents** dans l'URL. Précédent : `/confirm-by-provider` → `app/(dashboard)/(action-operation)/confirm-by-provider.tsx`. Le pay-merchant est sous `app/(dashboard)/(pay-merchant)/index.tsx` (param `code`). → il faudra une **route dédiée** que l'universal link cible (ex. `/checkout/[code]`) menant au flux pay-merchant.

**Infra** : EAS profils development / preview / production (`APP_VARIANT`) ; `slug: aigle-send`, owner `fintech-aigle`. Web `output: server` (EAS Hosting). Prod URL = `aigle-send.expo.app`.

## Objectif  *(à valider)*
**On construit** : la gestion, dans l'app aiglesend, d'un **universal link checkout** (`/checkout/<code>`)
qui — via un **deep link différé** (mémorise le code → login/déverrouillage → reprise) — amène le payeur
sur le **flux pay-merchant existant** pour régler le marchand **depuis son wallet**.
**Pour** : payer un checkout marchand (aiglepay) d'un tap sur un lien, sans scan, depuis son solde.
**Réussi si** : cliquer le lien (app installée) ouvre l'app, (ré)authentifie si besoin, affiche l'écran
pay-merchant pré-rempli avec le bon marchand, et le paiement wallet aboutit — le tout **testé sur un
déploiement Expo DEV** sans toucher `aigle-send.expo.app` prod ni les redirections post-paiement.

### Hors scope (ce lot)
- Génération du lien « Payer avec aiglesend » sur la page aiglepay.
- Fallback web (app non installée / payeur non-aiglesend → checkout mobile money).
- Déploiement **production** (domaine prod + release app).

## Design

### 1. Architecture  *(validé 2026-07-24)*
- **Route « aiguilleur »** `app/checkout/[code].tsx` (hors groupes auth, comme `confirm-by-provider`) =
  cible de l'universal link `…/checkout/<code>`. Pas d'UI (spinner) : logique de routage seulement.
- **Store d'intention** `pendingCheckout` : **store Zustand persisté** (`persist`/AsyncStorage, comme
  `debiteurStore`) — garde le `code`, survit au cold-start / mort du process pendant l'auth. Pas de
  provider (store global).
- **Aiguillage** (dans `[code].tsx`) : lit `code` + état auth/lock → **prêt** (connecté + déverrouillé)
  → `router.replace` vers `(pay-merchant)` avec le `code` ; **pas prêt** → store le `code` + route vers
  login/lock.
- **Hook de reprise** : au retour authentifié/déverrouillé, consomme `pendingCheckout` et route
  **automatiquement** vers pay-merchant (deep link différé, D3).
- **Réutilisation** : flux pay-merchant existant (`(pay-merchant)/index.tsx` + `usePayMerchant`)
  **inchangé** — l'aiguilleur y dépose juste le `code`.
- **Config universal-link DEV** (D4) : `applinks:`/`intentFilters` **dépendants de `APP_VARIANT`**
  (dev → domaine dev EAS Hosting ; prod → `aigle-send.expo.app` inchangé). Web déployé sur une URL
  EAS Hosting **de dev**.

### 2. Impact & flux de données  *(validé 2026-07-24)*
**Fichiers (app mobile)** :
| Fichier | Nature | Détail |
|---|---|---|
| `app/checkout/[code].tsx` | neuf | aiguilleur (lit `code`, aiguille selon auth + lock) |
| `stores/pendingCheckoutStore.ts` | neuf | **Zustand + `persist`/AsyncStorage** : `{ code, set, consume, clear }` |
| `hooks/usePendingCheckoutResume.ts` | neuf | au retour authentifié+déverrouillé → consomme le pending → route pay-merchant |
| `app/_layout.tsx` | modif | monter `usePendingCheckoutResume()` dans `RootLayoutNav` (dans `AuthProvider`) ; **pas de provider** (Zustand global) |
| `app.config.ts` | modif | `applinks:`/`intentFilters` selon `APP_VARIANT` (prod inchangé) |
| `(pay-merchant)`, `usePayMerchant`, backend | inchangés | ✅ |

**État lu par l'aiguilleur/hook** : `usePendingCheckoutStore()`, `useAuth()` (`AuthContext`), `useLockStore()`.

**Flux** :
```
1. Payeur tape …/checkout/<code>  → OS résout l'universal link → app (si installée)
2. Expo Router → checkout/[code].tsx (aiguilleur), code = useLocalSearchParams
3. Aiguilleur : PRÊT (connecté + déverrouillé) → router.replace('/(dashboard)/(pay-merchant)?code=<code>')
              PAS PRÊT → pendingCheckout.set(code) → router.replace login/lock
4. Login/déverrouillage OK → usePendingCheckoutResume voit le pending → route pay-merchant → clear
5. (pay-merchant) existant → usePayMerchant(code) → confirme → paiement wallet (pay_merchant backend)
```
Cold start : le lien = URL initiale → même aiguillage (AsyncStorage couvre une mort du process pendant l'auth).

**Risques de régression** : (a) `app.config.ts` — la **prod** garde `aigle-send.expo.app` à l'identique (sinon casse `confirm-by-provider`) ; le variant ne touche que dev. (b) Le hook de reprise n'agit **que** si un pending existe → zéro interférence. (c) L'aiguilleur **impose l'auth** (pas d'accès pay-merchant sans session).

### 3. Gestion des erreurs & cas limites  *(validé 2026-07-24)*
**Erreurs métier — réutilisent l'écran pay-merchant existant (zéro code neuf)** :
| Cas | Traitement |
|---|---|
| Code invalide / marchand introuvable | `resolveError` de `usePayMerchant` |
| Marchand inactif | `MerchantInactiveException` backend |
| Solde insuffisant | flux pay-merchant existant |
| Réseau KO à la résolution | erreur + retry existant |

**Cas limites — nouveaux (aiguilleur / store)** :
- **Code manquant/malformé** → route accueil, pas de crash.
- **Pending périmé** : store `{ code, createdAt }` + **TTL ~10 min** → pending trop vieux **ignoré**. `consume()` = lire puis clear (once).
- **Login annulé** : pending conservé (dans le TTL) → repris au prochain login réussi ; sinon expire.
- **Nouveau lien pendant un flux/pending** : `set(code)` **écrase** le pending précédent (**last-write-wins**) → le dernier lien gagne, pas d'accumulation ; l'aiguilleur `router.replace` amène sur le nouveau checkout.
- **Warm start** : listener Linking d'Expo Router → même logique que cold start.
- **Autre user aiglesend connecté** : il paie — aucun cas spécial.

**Inconnue levée (spike B2, 2026-07-25)** : sur `aigle-send--dev.expo.app`, EAS Hosting sert bien les `.well-known` **injectés** (AASA appID `…com.aigle.aiglesend.dev` + assetlinks package `.dev` / keystore `B7:95:DB…`) — l'injection écrase l'auto-gen. Côté serveur validé. Reste le **tap réel sur appareil** (build dev installé → le lien ouvre l'app dev, pas le navigateur) — vérif manuelle finale.

### 4. Vérification & découpage  *(validé 2026-07-24)*
**Vérification MANUELLE uniquement** (D5 — pas de tests auto) :
- Deep link e2e sur **déploiement DEV** : tap du lien dans tous les états (cold/warm × connecté/déconnecté/verrouillé) → écran pay-merchant pré-rempli, paiement wallet OK.
- Non-régression manuelle : `confirm-by-provider` (post-paiement) et pay-merchant par **scan** inchangés.

**Découpage (slices)** :
| # | Slice |
|---|---|
| **B1** | ✅ `stores/pendingCheckoutStore.ts` (Zustand `persist` + TTL 10 min + `consume`/last-write-wins) |
| **B2** | ✅ **Spike universal-link DEV** (côté serveur validé 2026-07-25 ; tap appareil = dernière vérif manuelle) : `app.config.ts` variant + `scripts/inject-dev-applinks.mjs` + `deploy --alias dev` |
| **B3** | ✅ Aiguilleur `app/checkout/[code].tsx` (route racine, lit `code`, aiguille selon auth/lock) + enregistré dans `app/_layout.tsx` |
| **B4** | ✅ Hook `hooks/usePendingCheckoutResume.ts` + monté dans `RootLayoutNav` (`app/_layout.tsx`) |
| **B5** | ✅ E2E manuel (appareil) : warm/déconnecté/verrouillé-PIN/verrouillé-biométrie → pay-merchant ; post-paiement → dashboard ; QR introuvable (no-retry). Verrou non-bypassable (D7). |

**Ordre** : B1 → **B2 (priorité, lève l'inconnue autoVerify)** → B3 → B4 → B5.

⚠️ Le **code vit dans le repo mobile** (`apps/aiglesend/mobile/aiglesend`) ; le design doc dans `api/docs/plans/`.
