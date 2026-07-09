# Sous-lot 4 — Paiement QR marchand — Design (chemin B d'abord)

Date : 2026-07-09. Cadre : module produit business (Lot 6). Objectif ~80 % produit :
**paiement marchand (b) → mass-paiement → KYB**.

## Décisions actées (utilisateur)
- **Chemin B d'abord** : les **APIs de paiement** (backend), **sans** la page aigleplay.
  Chemin A (payeur Aiglesend in-app, moveInternal) viendra après.
- **QR statique** : le payeur saisit le montant.
- **Frais = le payeur les supporte** (modèle legacy `init_checkout_transaction.ts:209` :
  `amountToPay = amount + fees` → le marchand reçoit le montant plein, le payeur paie
  `montant + frais`).

## Le constat de cadrage
Le marchand ne fait que **recevoir** ; c'est le **payeur** (anonyme, sans compte Aigle) qui
initie via mobile money. Ce n'est donc pas une feature de l'app aiglebusiness — c'est une
**opération argent publique** (payeur → compte marchand), orchestrée côté serveur (les APIs),
la page web aigleplay étant hors périmètre ici.

## Existant réutilisé (rien à réinventer)
- **Engine** `initiateExternalIn(ExternalInCommand)` : opérateur → crédit compte, **async → pending**,
  réglé au webhook. Exactement la primitive du chemin B.
- **`PayableAliasService.resolve(code)`** → `{ accountId, displayName, active }` (account_id jamais
  exposé publiquement — le resolve public ne rend que displayName+active).
- **Pattern deposit** (`aiglesend/operations/.../deposit.usecase.ts`) : routeur mince produit →
  construit la commande en codes → `engine.initiateExternalIn` → effets de bord.
- **Settlement par webhook** : `engine.settle({ reference, kind, outcome })` ; toute la mécanique
  argent (verrou, idempotence, mark tx/payment, crédit wallet, ledger, events) vit dans l'engine.
- **Webhooks providers** existants : hub2 (signature vérifiée) + wave.

## Flux cible (chemin B)
1. **Initiation** — `POST /api/checkout/:code` (public, non authentifié) :
   - résout `code` → compte marchand (via `PayableAliasService.resolve`) ; inconnu → 404 ;
     alias `active=false` → 409.
   - payload : `amount` (saisi par le payeur), moyen mobile money (`provider`, `msisdn`,
     `country`), + éventuel `otp` (Orange) / `success_url`/`error_url` (Wave).
   - construit `ExternalInCommand { toAccountId=compte marchand, source=opérateur payeur,
     type=CHECKOUT, amount, feeContext(payeur supporte les frais), metadata }`.
   - `engine.initiateExternalIn` → `pending` (+ `providerData` : redirect/OTP si synchrone).
   - réponse : `{ reference, status: pending, redirectUrl?, ... }`.
2. **Règlement** — webhook opérateur → `engine.settle({ kind: 'checkout', outcome })` : à la
   confirmation, **crédit du compte marchand** ; à l'échec, pas de crédit (rien à rembourser :
   l'argent n'a jamais quitté un compte Aigle, c'est un cash-in externe).
3. **Effets de bord** : notification marchand « encaissement reçu » (à confirmer si dans ce lot).

## À AJOUTER — core
1. `TransactionType.CHECKOUT` (déjà pré-noté en commentaire dans l'enum → décommenter).
2. `SettlementKind += 'checkout'` (aujourd'hui : deposit | transfert | transfert_inter_first|second).
3. `SettleCheckoutUseCase` (symétrique de `settle_deposit` : crédit compte marchand à la confirmation).
4. Routage du webhook checkout → `settle('checkout')` (réutilise l'adaptateur webhook + la
   vérification de signature existants).

## À AJOUTER — surface publique (emplacement à trancher)
- Un point d'entrée **public** `POST /api/checkout/:code` (payeur anonyme). Où le loger ?
  - **Option a** : `core/qr/presentation/public` (à côté du resolve). Simple, mais un checkout
    n'est pas « du QR », c'est « de l'argent ».
  - **Option b (recommandée)** : nouveau contexte **`core/money/checkout`** (ou
    `money_movement/presentation/public`) — sémantiquement juste : opération argent publique.
- **Anti-abus** : rate-limit (public, non authentifié) — par code marchand + par IP.

## Frais (modèle legacy confirmé)
- Le payeur paie `amount + fees` ; le marchand reçoit `amount`. Le `feeContext` doit produire un
  débit opérateur `amount + fees` (gross-up côté payeur) — `includeFees:false` (amount = net, frais
  ajoutés). **À vérifier contre `fee_resolver`** que ce flag donne bien ce comportement pour un IN.
- (La commission PDV du legacy est **hors périmètre** — PDV/School abandonnés.)

## Décisions structurelles (actées)
1. **Emplacement** : nouveau contexte **`core/money/checkout`**. Route **neutre**
   `POST /api/checkout/:code` (rien n'indique « marchand » — un code payable pourrait désigner
   n'importe quel compte).
2. **Statut** : **oui**, `GET /api/checkout/:reference/status` (polling pending→success/failed).
3. **Notification marchand** : **oui, dans ce lot** (push au marchand à la confirmation).
4. **Providers** : **mobile money générique (hub2) d'abord** ; Wave (redirect/lien SMS) en phase 2.

## Plan d'implémentation (chemin B)
**Core :**
- (a) `TransactionType.CHECKOUT` (décommenter).
- (b) `SettlementKind += 'checkout'`.
- (c) `SettleCheckoutUseCase` (jumeau de `settle_deposit` : crédit compte marchand à la
  confirmation ; échec = pas de crédit, aucun refund — cash-in externe).
- (d) routage `settle('checkout')` dans `money_movement_engine_impl` + le webhook hub2.
**Contexte `core/money/checkout` :**
- `application/use_cases/initiate_checkout.use_case.ts` : resolve code → `ExternalInCommand`
  (type CHECKOUT, toAccount=marchand) → `engine.initiateExternalIn`.
- `application/use_cases/get_checkout_status.use_case.ts` : état par référence.
- `presentation/public/{controllers,routes,validators}` : `POST /api/checkout/:code`,
  `GET /api/checkout/:reference/status` (non authentifiés) + throttle (code + IP).
**Notification :** event de crédit marchand → listener push « encaissement reçu ».
**Doc + tests** à chaque étape (règle [[always-update-api-doc]]).

## Tarification business — RÉSOLU (Option A : service type dédié)
Le SPM (tarification) est clé par `(service_type × payment_method × provider_from × provider_to)` —
aucune dimension user ni produit. Le calcul de frais n'est **pas** couplé au user (vérifié :
contrôleur, use case, `CatalogResolver`, `fee_calculator`). Le « couplage aiglesend » venait de
l'absence de service type marchand.
- **Décision** : service type dédié **`checkout`** (« Paiement marchand ») ; sa tarification
  business vit dans ses propres lignes SPM (tarif aiglesend `deposit` ≠ tarif business `checkout`).
  **Aucune migration** (SPM déjà clé par service_type). Les futures ops business (`payout`,
  `mass_payout`) seront leurs propres service types.
- **Déjà créé en back-office** : le service type `checkout` + ses lignes SPM (tarifs business)
  existent → **rien à seeder**.
- Le flux checkout utilise `serviceTypeCode: 'checkout'` → `fee_resolver` → tarifs business.
  `TransactionType.CHECKOUT = 'checkout'` (enum code, aligné).
- **Catalogue aigleplay** : exposer un endpoint **public neutre** (le catalogue existant est
  préfixé `mobile/` mais déjà sans auth) — ex. `GET /api/checkout/payment-options` renvoyant les
  options `checkout` (via le use case catalogue existant). À intégrer au module `core/money/checkout`.

## PRÉREQUIS — D8 : argent account-centrique (décision utilisateur : Option 1)
Créditer un marchand = créditer un **compte org sans user**. Or `transactions` est user-centrique
(`users_id`/`users_uid` FK users, pas de `account_id`) et `partyValidator` exige un `User`. C'est le
fondement reporté (D8) ; il sert **B, A, mass-paiement, dashboards**. **Money-critical** → étapes
isolées, suite consumer comme filet (l'USER exécute les migrations).

**Invariant de sécurité** : pour un user, `account_id == usersUid` → les chemins consumer restent
identiques (on peuple `account_id` en plus, on ne retire rien).

**Étape 1 — Fondation additive (aucun changement de comportement)** :
- Migration `transactions` : ADD `account_id` (uuid, nullable, indexé) ; relâche `users_uid` en
  **nullable** (garde la FK, autorise NULL, comme wallets au SL1) ; backfill `account_id = users_uid`.
- `WalletService.getByAccountId(accountId)` (le repo a déjà `findByAccountId`).
- `createTransaction` peuple `account_id` (dérivé du wallet) pour TOUS les flux + rend `user`
  optionnel (un marchand passe le compte, `users_*` null). → suite verte requise.

**Étape 2 — Chemin encaissement marchand (account-centrique)** :
- Résolution wallet par `account_id` ; validation **account-based** d'un marchand récepteur
  (compte + wallet actifs ; PAS de KYC/device — le marchand n'est pas l'acteur, le payeur anonyme l'est).
- `settle_checkout` crédite par compte (`getByAccountId`), pas `getByUserId` ; échec = pas de refund.
- `TransactionType.CHECKOUT` + `SettlementKind += 'checkout'` + routage webhook.

**Étape 3 — API checkout publique + statut + notif** (cf. plan d'implémentation ci-dessus).

## Hors périmètre (rappel)
- Page web aigleplay (frontend) — on ne livre que les APIs.
- Chemin A (payeur Aiglesend in-app / moveInternal) — lot suivant.
- Mass-paiement — après le paiement marchand.
- KYB entreprise — après le mass-paiement.
