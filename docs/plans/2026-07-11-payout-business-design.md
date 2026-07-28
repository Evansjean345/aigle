---
type: design
statut: approved (Lot 1 livré ; Lot 2 mass-payout — brainstorm de reprise CLOS, prêt pour writing-plans)
derniere_maj: 2026-07-21
session_courante: S7 (Lot 2 : brainstorm de reprise clos B1→B10, décisions L2-D1→L2-D28)
lot: 2 — paiement en masse (batch)
---

# Paiement business — transfert unique + paiement en masse (payout)

Aujourd'hui un compte **business** (marchand/entreprise) peut **encaisser** (checkout, pay-merchant)
mais **ne peut rien envoyer**. On lui ouvre la capacité de **payer** :
- **transfert unique** (1 → 1 : salaire ponctuel, fournisseur, remboursement…) ;
- **paiement en masse** (1 → N : paie du mois, primes, fournisseurs).

> Méthode : brainstorming **session par session** (proposé → validé → suivant). **Rien codé** tant
> que ce n'est pas bouclé. Migrations lancées par l'utilisateur.

## Découpage en lots  *(décidé 2026-07-20)*
On **implémente le transfert unique d'abord**, le paiement en masse ensuite. Les sessions S1–S6
ont conçu l'ensemble ; on **livre par lots** :

| Lot | Contenu | Dépend de | Statut |
|-----|---------|-----------|--------|
| **1 — Transfert unique** | Payout **interactif inline** (N=1) : membre `payout:initiate` → résolution org→account → `initiateExternalOut` **direct dans la requête** (débit normal, **pas** de réservation-hold, **pas** de relais) → settlement/refund par webhook **déjà en place**. **Aucune restriction par segment** : le **plafonnement = les limites de transactions** du compte (via `PartyValidator`). Frais grille `transfert`, `TransactionType.PAYOUT`. Destination **externe** (mobile money). | Engine + settlement existants | **design en cours (S7)** |
| **2 — Paiement en masse** | Batch pipeline complet (S1–S6) : `payout_batch`/`payout_item`, réservation-hold, ingestion XLSX, relais outbox + gouverneur d'égress, agrégation/succès partiel, maker-checker, réconciliation cron. | Lot 1 | à faire |

**Conséquence pour le Lot 1** : le chemin interactif (D-exec-6) **n'a besoin ni des tables batch,
ni du relais, ni de la réservation** — la traçabilité passe par la **transaction core** créée par
`initiateExternalOut` (`TransactionType.PAYOUT`). Tout le pipeline async (S3b, S4, S5-réconciliation)
est **reporté au Lot 2**.

### Décisions Lot 1  *(validées 2026-07-20)*
- **L1-D1 — Transfert direct uniquement** : pas de maker-checker, pas de seuil au Lot 1. Le
  transfert unique s'exécute **inline** dans la requête. Approbation + persistance `payout` →
  **Lot 2**.
- **L1-D2 — Zéro nouvelle table** : aucune migration de données pour le Lot 1. La transaction core
  (`TransactionType.PAYOUT`) est la source de traçabilité/reporting.
- **L1-D3 — Endpoint `/transfers`** : `POST /api/business/organisations/{organisationId}/transfers`
  (vocabulaire « transfert », proche de l'usage). Le mass-payout du Lot 2 prendra sa propre ressource.
- **L1-D4 — Frais = grille `transfert` existante** : `feeContext.serviceTypeCode = TRANSFERT` au Lot 1
  (zéro seeder). Le service type `payout` dédié (S6-P4) est **reporté** — retarification ultérieure.
- **L1-D5 — Permission seule** : auth membre + `payout:initiate` (sensitive) + device business
  suffisent ; pas de PIN/OTP au Lot 1. Confirmation forte ⤳ Lot 2 (avec le maker-checker).
- **L1-D6 — Pas de restriction par segment ; les LIMITES sont le gate** *(2026-07-20, supersede
  la ⭐ règle d'éligibilité S6)* : **marchand comme entreprise peuvent décaisser**. Le contrôle
  d'autorisation de montant repose **entièrement** sur les **limites de transactions** du compte,
  résolues via `(segment, level)` → grille `kyc_level` et appliquées par le **`PartyValidator`** dans
  `external_out` (chemin argent existant). Conséquence naturelle de la grille : enterprise niveau 0
  (plafonds `0`) → **de facto bloqué** ; marchand → plafonné à ses limites ; enterprise niveau 2
  (`null`) → illimité. **Aucun code de gate produit** (pas de `PayoutNotEligibleException`).

- **L1-D7 — Taxonomie unifiée : PAS de type `payout`** *(2026-07-21, supersede L1-D2/B1/B4 et S6/S7
  sur le type)* : **tout mouvement de fonds vers un compte externe** (business OU aiglesend) est un
  **`TransactionType.TRANSFERT`**. On **n'introduit pas** de type `payout`. Conséquence : le
  décaissement business est réglé / remboursé / affiché par le **chemin transfert existant**, sans
  aucun cas spécial (`resolveKind`, `RefundService`, `TransactionDisplayService` inchangés). ⚠️ Ne
  pas confondre avec l'**opération PROVIDER** `'payout'` (gateway cash-out, Hub2/Wave + jambe 2 de
  l'inter-réseau) qui, elle, **reste**. Anciennes transactions dev `operation_type='payout'` migrées
  vers `'transfert'`.
- **L1-D8 — Rename code `payout` → `transfer`** *(2026-07-21)* : cohérence du nommage avec L1-D7. Le
  module devient **`aiglebusiness/transfer/`** (`InitiateTransferUseCase`, `TransferRequestDto`,
  `BusinessTransferController`, `transferValidator`, `businessTransferRoutes`), la permission
  **`transfer:initiate`** / `transfer:approve` (clés `transferInitiate`/`transferApprove`), les
  schémas swagger `TransferRequest`/`TransferResponse`. ⚠️ **DB non modifiée** : les slugs
  `payout:initiate`/`payout:approve` restent dans `organisation_role_permissions` — **mise à jour
  manuelle** prévue (l'OWNER bypasse la permission entre-temps). L'endpoint reste `POST …/transfers`.
  *(NB : le reste de ce document — Lot 2 « mass-payout » — garde « payout » comme nom historique du
  projet ; seul le Lot 1 est renommé en code.)*

### Décisions Lot 2 (reprise implémentation)  *(validées 2026-07-21, brainstorm de reprise)*
Registre des décisions prises en début d'implémentation Lot 2. Elles **priment** sur le corps du doc
(sessions S1–S7) là où elles divergent.

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| **L2-D1 — Nommage `transfer_*`** | Tables `transfer_batches`/`transfer_items`, contexte core **`core/money/transfer/`** (modèles `TransferBatch`/`TransferItem`, jobs `TransferRelayJob`/`ProcessTransferItemJob`), module produit `aiglebusiness/transfer/mass` (« transfert de masse »), permissions `transfer:initiate`/`transfer:approve`. | `payout_*` (nommage historique du doc). | Cohérence avec L1-D7 (tout mouvement externe = TRANSFERT) + rename Lot 1 (L1-D8). ⚠️ Slugs DB `organisation_role_permissions` restent `payout:*` — MAJ manuelle en attente (OWNER bypasse). | 2026-07-21 |
| **L2-D2 — Réservation = option A (débit gardé du total, PAS de colonne `held`)** | **C** (« held/available » : colonne `held`, disponible = `balance − held` → réécrit toute lecture de solde de l'app). **Raccourci-C** (`balance` = disponible + colonne `held` = réservé, maintenue en parallèle — évite le refactor des lectures mais garde le coût du compteur). | Résultat financier **identique** aux 3 options. A ne change **aucun** schéma wallet ; `held` serait un compteur à maintenir atomiquement sur **chaque** transition (réservation/succès/échec/annulation/réconciliation/ambigu/dead-letter), **redondant** avec la table `items` (`SUM(items WHERE status in queued/sending/sent)`), et **rien ne le consomme** aujourd'hui (YAGNI). L'« en vol » se calcule à la demande depuis `items`. | 2026-07-21 |
| **L2-D3 — B1 prefunded : saute débit ET ligne ledger de débit** | Garder une ligne ledger de débit par item (lecture littérale de S4/D-exec-2 « garde ledger »). | Le `Ledger` est un journal single-entry du **solde wallet** ; le débit réel a lieu **une fois** au hold (L2-D2). Une ligne par item re-stamperait le solde → **double-comptage** (solde reconstruit faux). L'item garde son **record transaction** (source comptable, S2-P3) mais **aucune** ligne de solde ; events `WALLET_DEBITED`/`LEDGER_ENTRY_CREATED` sautés en prefunded. | 2026-07-21 |
| **L2-D4 — Le hold s'écrit directement au ledger, SANS transaction (`transaction_id = null`)** | **2a** — porter le hold par une transaction de réservation au niveau lot (moule « paiement » du codebase). | En comptabilité, une écriture n'exige pas un **paiement** pour cause, seulement une **cause traçable** ; la réservation **est** une cause légitime (hold/autorisation). Le FK `ledgers.transaction_id → transactions` est un choix *local* du codebase, déjà **nullable**. On écrit donc le hold en direct : `DEBIT`, `operationType='reservation'`, `transaction_id=null`, cause = `reservation_ref` → batch. Impacts : `Ledger.transactionId` → `number \| null` + belongsTo optionnel ; nouvelle méthode `LedgerService.recordHold(...)` (operationType/description en dur). Release inchangé (refund sur la transaction **de l'item**, bien réelle). ⚠️ Vigilance : un `INNER JOIN ledgers→transactions` en reporting **exclut** la ligne de hold (voulu). | 2026-07-21 |
| **L2-D5 — B2 : clé primaire entière (`increments`)** | PK `uuid` (comme disait le design doc §6). | Convention du codebase : `ledgers`, `wallets`, `transactions` utilisent tous `table.increments('id')`. `reference` (string `transfer_xxx`) = identifiant métier public ; `account_id` (uuid) = compte source. Évite un mélange uuid/int incohérent. | 2026-07-21 |
| **L2-D6 — B3 : ressource `.../mass-transfers`** | `.../transfers/mass` (sous-ressource). | Ressource propre pour le mass (L1-D3) : `POST .../mass-transfers`, puis `.../mass-transfers/upload` (B7), `.../mass-transfers/:id/approve` (B8), `GET .../mass-transfers/:id`. Miroir des middlewares Lot 1 + `orgPermission(transferInitiate)`, idempotence header `X-Idempotency-Key`. | 2026-07-21 |
| **L2-D7 — B3 : frais différés à B10** | Câbler `FeeResolver` dès B3. | Le hold de B3 réserve `Σ montant` seul (frais = 0) ; B10 branche le calcul des frais et le hold devient `Σ(montant+frais)`. La mécanique de réservation ne change pas (juste le total). Garde les slices petites et vertes (TDD). | 2026-07-21 |
| **L2-D8 — B3 : cap JSON = 50 (révisé)** | ~1 000 ; cap dur legacy (20). | MVP : entrée **JSON uniquement**, plafond **50 bénéficiaires**. Bulk-insert synchrone trivial. *(Révisé le 2026-07-21 : voir L2-D19 — le fichier XLSX est reporté.)* | 2026-07-21 |
| **L2-D9 — B4 : gouverneur BATCH-only (A1), partagé différé en B4b** | A2 — gouverneur partagé complet devant l'adaptateur Hub2 dès B4 (touche consumer + single + mass). | Un token bucket Redis « voie batch » suffit à garder le mass sous la limite Hub2 (~7/s) **sans toucher** l'égress consumer existant → zéro risque de régression. La priorité fine interactif > batch (gouverneur partagé, D7) = slice de durcissement dédiée **B4b**. | 2026-07-21 |
| **L2-D10 — B4 : relais auto-replanifié (pas de scheduler)** | Commande ace + cron OS ; repeatable job natif. | Aucun scheduler récurrent n'existe dans le codebase. `TransferRelayJob` se **re-dispatch** avec délai (~1-2 s) tant qu'il reste des items dus, s'arrête file vide. Zéro nouvelle dépendance. (Même approche pour la réconciliation B6.) | 2026-07-21 |
| **L2-D11 — B4 : retry via l'item (`next_retry_at`), pas retry natif queue** | Retry natif de `@adonisjs/queue`. | Un retry doit **repasser par le relais** (donc par le token bucket) sinon il court-circuite le débit gouverné. Sur erreur retryable : pas de throw ; `attempts++` + `next_retry_at=backoff` + statut repris par le relais. Retry natif désactivé pour ce job. | 2026-07-21 |
| **L2-D12 — B4 : politique de retry serrée (payout)** | Backoff aiglehub `(2^n−1)×60s` / MAX 10 (~34 h). | base **30 s**, backoff exponentiel, **MAX ~6** (dead letter ~2-4 h) → un payout ne reste pas coincé une journée ; la réconciliation (B6) prend le relais. Valeurs ajustables. | 2026-07-21 |
| **L2-D13 — B5 : ajouter le dispatch d'échec au settlement** | Laisser `settle_transfert` échec sans event de flux (état actuel). | `settle_transfert.applyFailure` n'émet aujourd'hui **aucun** `TransfertTransactionFailed` (seulement audit + refund) → le suivi n'a pas de signal d'échec. On l'ajoute, symétrique du succès (`reference`, `accountId`). | 2026-07-21 |
| **L2-D14 — B5 : suivi via events génériques + lookup `transaction_reference`** | Event de settlement dédié émis par le core `settle` (couplerait le core money au contexte transfer). | `TransferItemSettledListener` (contexte transfer) s'abonne à `TransfertTransactionCompleted`/`Failed` et rattache l'item par `SELECT transfer_item WHERE transaction_reference=ref` (pas trouvé → transfert consumer/unique → ignore). Le core `settle` reste **générique**. Compteurs batch en `FOR UPDATE` (atomique) → agrégation completed/partial/failed. Release = refund existant (inchangé). | 2026-07-21 |
| **L2-D15 — B5 : couper la notif consumer par item** | Laisser `OnTransfertSuccessNotification` tirer par item. | Guard `userId == null` (compte org) → skip : pas de push aiglesend par employé. Le lot enverra **sa propre** notif de synthèse (aiglebusiness, S5-P5) **différée**. Corrige aussi le cas latent du transfert unique Lot 1 (userId null). | 2026-07-21 |
| **L2-D16 — B6 : réconciliation GÉNÉRIQUE money-core (pas transfer-scoped)** | Job scannant `transfer_items` (spécifique mass, découpage initial). | Un item = une transaction `TRANSFERT` (L1-D7) → la réconciliation doit couvrir **toute transaction externe PENDING** (transfert consumer, unique, items mass, deposit/inter). Le job vit côté **settlement money-core**, scanne `transactions` (externe + PENDING + `provider_reference` + `updated_at < now-T`), poll → `engine.settle` (idempotent). Les items sont couverts **gratuitement** : le `TransferItemSettledListener` (B5) met à jour l'item + le lot au settle. Poll = op provider **générique routée par kind** (`pollStatus(operation, providerRef)`) ; transfert implémenté d'abord (n'existe pas encore). ⚠️ Blast radius élargi (réconcilie aussi le consumer) mais additif/faible risque. | 2026-07-21 |
| **L2-D17 — B6 : cron self-rescheduling ~5-10 min, T≈20 min** | — | Réutilise le pattern self-rescheduling (L2-D10), pas de scheduler. Seuil T ≈ 20 min sans nouvelle. Configurables. | 2026-07-21 |
| **L2-D18 — B6 : `needs_review` pour irrésolus/ambigus** | Release systématique. | Item/tx `sent` toujours pending après seuil dur, ou poll ambigu → `needs_review` (pas de release, anti double-crédit), revue manuelle. C'est là que vit l'état `needs_review` (laissé de côté en B5). | 2026-07-21 |
| **L2-D19 — B7 (ingestion fichier XLSX) DIFFÉRÉ** | Livrer l'upload XLSX streaming (exceljs) dans le MVP. | MVP = **entrée JSON seule** (≤ 50, L2-D8). On **reporte** : endpoint `.../mass-transfers/upload`, `IngestTransferFileJob` streaming, lib `exceljs`, `appendItems`/`finalize`-from-file, états `ingesting`/`failed_ingestion`. Le pipeline d'exécution (réservation, relais, settlement, réconciliation, maker-checker) **reste** — seule la voie d'ingestion fichier est différée. **Conséquence enum** : `TransferBatchStatus` **omet** `ingesting`/`failed_ingestion` pour l'instant (rajoutés avec B7). Évolution future quand les gros lots seront nécessaires. | 2026-07-21 |
| **L2-D20 — B8 : approbation TOUJOURS requise pour un mass-payout** | Seuil de montant (petits lots directs). | Un décaissement en masse → **toujours** `pending_approval` (contrôle systématique = cœur du maker-checker fintech). Le batch naît `pending_approval` (B3 ajustée), le relais l'ignore tant qu'il n'est pas `queued`. | 2026-07-21 |
| **L2-D21 — B8 : séparation des tâches, exception OWNER** | Aucune contrainte ; ou séparation stricte sans exception. | Approbateur (`transfer:approve`) **≠** initiateur (sinon 403), **sauf** si l'approbateur est l'**OWNER** (org à une personne → sinon jamais approuvable). | 2026-07-21 |
| **L2-D22 — B8 : `releaseHold` transaction-less (rejet/annulation)** | Réutiliser le refund-sur-transaction (utilisé pour un échec d'item). | Le hold est **sans transaction** (L2-D4) → le refund-sur-tx ne s'applique pas. Rejet/annulation libère **tout le hold** : crédit wallet du total + ligne ledger reversal **sans transaction** (`LedgerService.recordHoldRelease`, symétrique de `recordHold`). Distinct du release **par item** (échec → refund sur la tx de l'item). | 2026-07-21 |
| **L2-D23 — B9 : GATE le mass est ENTERPRISE-only (marchand bloqué)** | Pas de gate segment (ce que disait L1-D6). | ⚠️ Précision : **L1-D6 (marchand peut décaisser) vaut pour le transfert UNIQUE** ; le **paiement en MASSE** est réservé aux comptes **ENTERPRISE**. Middleware `requireEnterpriseForMass` sur le groupe `.../mass-transfers` (après `orgPermission`) : `org.accountType === ENTERPRISE` sinon **403 `E_MASS_TRANSFER_ENTERPRISE_ONLY`**. Réutilise le check de type d'org existant (`OrganisationAccountType`, `assertOrganisationAllowsTeam`) avec une erreur propre au mass (le `RequireEnterpriseMiddleware` existant porte la sémantique « équipe »/`E_MERCHANT_NO_TEAM`, non réutilisé tel quel). KYB **hors gate** (enterprise L0 bloqué par ses limites). | 2026-07-21 |
| **L2-D24 — B9 : lecture via `transactions:view`** | Nouvelle permission dédiée. | `GET .../mass-transfers` (liste, filtrable par statut — alimente la file d'approbation) + `/:id` (détail batch+items) gardés par `transactions:view` (existe). | 2026-07-21 |
| **L2-D25 — B9 : notifications d'approbation différées** | Les livrer dans B9. | Notif « lot à approuver » (aux `transfer:approve`) + « lot approuvé/rejeté » (à l'initiateur) = notifications aiglebusiness, **différées** avec la synthèse de lot (S5-P5). B9 livre les endpoints ; les notifs suivent. | 2026-07-21 |
| **L2-D26 — B9 : DTO minimal (pas de modèles Lucid bruts)** | Exposer les modèles. | Batch `{reference,label,status,total,fees,expectedCount,successfulCount,failedCount,initiatedBy,approvedBy,createdAt}` + items `{sequence,recipientName,recipientPhone,operator,amount,status,failureReason}`. | 2026-07-21 |
| **L2-D27 — B10 : grille de frais `transfert` (pas de service type dédié)** | Service type catalogue `payout`/`mass-transfer` dédié (S6-P4). | `feeContext.serviceTypeCode = TRANSFERT`, comme le Lot 1 (L1-D4) : zéro seeder, cohérent L1-D7. Le service type dédié (retarification business) = évolution future. La business paie (`includeFees=false`, total = montant + frais). | 2026-07-21 |
| **L2-D28 — B10 : fee figée passée au prefunded (pas de recalcul)** | Laisser `external_out` recalculer les frais par item. | Frais **pré-calculés à l'initiation**, figés sur `transfer_item`. `ExternalOutCommand` reçoit un champ optionnel `fees` ; en mode **prefunded**, `external_out` **saute `FeeResolver`** et utilise la fee figée (sinon un changement de grille entre initiation et drain ferait diverger la fee du hold). Mode normal (consumer/Lot 1) inchangé. | 2026-07-21 |
| **L2-D29 — B6 : la référence provider + l'agrégateur vivent sur `payments`, pas sur `transactions`** *(précise et corrige L2-D16)* | `transactions.provider_reference` (ce que disait L2-D16). | ⚠️ L2-D16 supposait une réf provider **sur la transaction** — structurellement faux : une transaction peut porter **plusieurs paiements** (inter-réseau = 2 jambes = **2 réfs provider distinctes**) ; la 2ᵉ jambe écraserait la 1ʳᵉ. `payments` modélise déjà le grain (`step`). → **M4** ajoute `payments.provider_reference` (nullable, index) **et** `payments.aggregator` (nullable, index). L'**agrégateur** (= `PaymentProviderPort.providerName` : `hub2`, `wave`, demain visa…) rend le **poll générique routable** : `registry.get(payment.aggregator).pollStatus(...)`. Sans lui, impossible de savoir qui interroger — le besoin est **déjà réel** (2 adapters coexistent : `hub2` **et** `wave`), pas anticipatif. La réconciliation scanne donc `payments` (jointure tx PENDING + `provider_reference` + `updated_at < now-T`). | 2026-07-28 |
| **L2-D30 — B10 : tarification *par bénéficiaire*** *(confirme L2-D27)* | Forfait par lot ; grille dédiée mass dès le MVP. | Confirmé après revue du marché : chez les agrégateurs mobile money (Flutterwave, Paystack, MFS Africa, Hub2) comme chez les opérateurs, **le coût d'achat est par transaction** — un forfait au lot exposerait à une **marge négative mécanique** sur les gros lots (500 salaires coûtent 500×). On garde donc la grille `transfert` existante, appliquée **par item**. ⚠️ Choix **assumé et réversible** : la fee passant par `FeeResolver` et étant **figée par item**, basculer plus tard vers un tarif **dégressif par volume** ou négocié entreprise (pratique courante sur le payroll) revient à changer la grille du catalogue, **pas** le code → évolution attendue, pas un oubli. ⚠️ **Non vérifié** : le coût d'achat réel Aigle↔Hub2 doit fixer le plancher de la grille. | 2026-07-28 |
| **L2-D31 — B10 : les frais sont remboursés avec le montant sur TOUT échec d'item** | Garder les frais si l'item est déjà parti (le coût opérateur a été engagé) ; ne jamais rembourser. | **Le client ne paie que ce qui a abouti** — règle unique, quel que soit le moment de l'échec (à l'envoi *ou* au webhook). Deux raisons : (1) **invariant de fonds simple et auditable** — `hold == Σ(succeeded) + Σ(released)` reste vrai sans cas particulier ; une règle à deux branches rendrait la réconciliation comptable subtile et donc fragile ; (2) l'échec (numéro inactif, compte plafonné) n'est **pas imputable au client**, garder les frais serait perçu comme punitif. Aigle absorbe le coût des tentatives rejetées par l'opérateur. **Déjà le comportement du code** : `onFailure` libère `amount + fees`. | 2026-07-28 |
| **L2-D32 — B10 : un échec de tarification à l'initiation rejette TOUT le lot (422)** | Écarter le seul item fautif et créer le lot ; ou lui mettre des frais à 0. | **All-or-nothing**, aucun lot créé, aucun hold posé, message nommant le bénéficiaire fautif. (1) **Le maker-checker l'impose** (L2-D20) : l'approbateur valide un montant total — un lot silencieusement amputé lui ferait approuver autre chose que la demande du client. (2) Un échec de tarification est un **défaut de configuration** du catalogue, pas un cas métier : le rejet le rend visible, l'écarter le laisse en place et le mettre à 0 fait **perdre de l'argent en silence** (on paie l'opérateur sans contrepartie). (3) C'est l'échec **le moins cher** : on est *avant* tout mouvement d'argent, rien à défaire, rejeu immédiat. (4) **Cohérence** : l'initiation rejette déjà tout le lot sur solde insuffisant (B3) — deux sémantiques concurrentes à la même étape seraient une source de bugs. ⚠️ Ne vaut que **parce que c'est à l'initiation** ; la tarification ne peut pas échouer au drain puisque L2-D28 fige les frais en amont. | 2026-07-28 |
| **L2-D33 — B11 : simulation de frais sur la LISTE des bénéficiaires (pas sur un total)** | Estimer à partir d'un montant total + un nombre de bénéficiaires ; ou offrir les deux modes. | La simulation prend **le même payload que l'initiation** et appelle **la même fonction** (`resolveItemFees`) → le devis ne peut **pas** diverger du débit réel, par construction. Une estimation depuis un total seul serait **fausse par nature** : les frais dépendent du couple *(montant, opérateur)* de chaque ligne — une grille à paliers rend le coût dépendant de la répartition, et le mix d'opérateurs est inconnu. Or cette API existe pour qu'on approvisionne **le bon montant** : un chiffre approximatif ferait recharger à côté puis rejeter l'initiation pour solde insuffisant — l'échec même qu'elle doit empêcher. Coût nul pour le marchand : préparant une paie, il **a déjà** la liste. Les deux modes = deux chiffres pour une même question, et c'est toujours le plus optimiste qu'on retient. | 2026-07-28 |
| **L2-D34 — B11 : la réponse porte le *manque à approvisionner*, pas seulement les frais** | Pur calculateur de grille (montants + frais). | La question métier n'est pas « combien coûtent les frais » mais « **combien dois-je recharger** ». La réponse confronte donc le coût au **solde réel** : `totalAmount`, `fees`, `total`, `balance`, **`shortfall`** (0 si le solde suffit). Sans le solde, le marchand doit aller le chercher ailleurs et soustraire — on lui laisserait le calcul dont l'erreur bloque son virement. **Détail par bénéficiaire écarté** au MVP : les totaux répondent à la question posée ; le ligne-à-ligne (arbitrage par opérateur) est une évolution. | 2026-07-28 |
| **L2-D35 — B11 : rate limiters sur `simulate` ET l'initiation, clés par ORGANISATION** | Aucun throttle (gate + permission + idempotence jugés suffisants) ; ou clé par IP comme les throttles checkout. | **Clé par organisation, pas par IP** : contrairement au checkout (payeur anonyme), l'appelant est authentifié — une clé IP pénaliserait les collègues derrière un NAT partagé *et* se contournerait en changeant d'IP. **`simulate` : 30/min** — un marchand ajustant sa paie simule 5-20 fois (jamais gêné), mais la **cartographie de la grille tarifaire** (balayage montants × opérateurs) devient impraticable ; blocage 1 min seulement, une rafale accidentelle (double-clic, retry front) ne doit pas punir un usage légitime. **`initiate` : plus strict** — chaque appel **pose un hold** sur des fonds réels ; l'idempotence ne protège que du **rejeu de la même clé**, rien n'empêche N lots distincts d'affilée. Approve/reject non throttlés : déjà gardés par garde d'état (409) + `FOR UPDATE`. | 2026-07-28 |
| **L2-D36 — B12 : la ligne ledger de hold/release VENTILE montant et frais** | Laisser `fees: 0` (le hold est un mouvement de trésorerie, pas une opération tarifée). | Depuis B10, `hold = Σ(montant + frais)` — mais `recordHold` écrit `amountBrut = total, fees = 0`, donc la ligne **s'auto-contredit** (`brut + frais ≠ total`) et surévalue le principal. Objection du double comptage **écartée après vérification** : en mode `prefunded`, `external_out` **saute l'écriture ledger** par item (B1) → le hold est le **seul** endroit où ces frais peuvent figurer au journal ; à 0, ils sont purement **invisibles** en comptabilité. Correctif : `recordHold`/`recordHoldRelease` reçoivent la ventilation (`amountBrut = Σ montants`, `fees = Σ frais`, `totalAmount = brut + frais`), le release ventilant symétriquement la part libérée. **Pas de reprise d'historique** : les lignes existantes proviennent de tests manuels. | 2026-07-28 |

**TODO fin de brainstorm (2026-07-21) — ✅ FAIT.** `docs/systeme-paiement-masse.md` **a été
resynchronisé** le 2026-07-21 avec toutes les décisions L1/L2 (nommage `transfer_*`, éligibilité
nuancée single/mass, type TRANSFERT, réservation option A + hold sans transaction, JSON≤50, gouverneur
batch-only, réconciliation générique money-core, frais grille `transfert`, gate enterprise). Rappel de
ce qui a été corrigé : **éligibilité**
(dit « ENTREPRISE+L2, marchand receive-only » uniformément → doit être **nuancé** : transfert
**unique** = marchand OK, plafonné par les limites (L1-D6) ; paiement en **masse** = **ENTERPRISE
seulement**, marchand bloqué (L2-D23)) ; **type** (dit `TransactionType.PAYOUT` → doit être TRANSFERT, L1-D7) ; **nommage** (`payout_*`
→ `transfer_*`, L2-D1) ; **ledger prefunded** (dit « + ledger » par item → option A sans ligne par
item, L2-D3) ; **frais** (service type `payout` dédié → à trancher B10). Le reste du doc reste juste.

**Cible future notée (inconnue tracée).** Le vrai double-entry avec compte de réserve — c.-à-d. le
**raccourci-C** (`balance`=disponible + `held`=réservé) — est **l'évolution privilégiée** dès qu'une
feature devra **afficher/utiliser** le montant réservé (« X dispo, Y en cours de paiement ») ou agir
dessus. Migration **A → raccourci-C non-cassante** : le raccourci garde `balance -= total` à la
réservation (identique à A), donc on **ajoute** seulement la colonne `held` sans toucher la sémantique
de `balance` ni le code existant. À trancher au moment du besoin, pas avant.

### Synthèse Lot 2 — périmètre MVP & carte des slices  *(brainstorm de reprise clos 2026-07-21)*

**Nommage** `transfer_*` (L2-D1). **Réservation** = option A : débit gardé du total, **pas** de colonne
`held` (L2-D2) ; le hold s'écrit **directement au ledger sans transaction** (L2-D4). **Entrée** = JSON
≤ 50 (fichier XLSX différé, L2-D19). **Gate** = mass réservé aux **ENTERPRISE** (L2-D23 ; le marchand
garde le transfert unique via L1-D6).

| Slice | Contenu MVP | Décisions clés |
|---|---|---|
| **B1** | Engine `initiateExternalOut({prefunded})` : pas de débit, pas de ligne ledger de débit ; record tx + provider gardés | L2-D3 |
| **B2** | Modèles `TransferBatch`/`TransferItem` (PK entière) + réservation (hold direct au ledger) + release | L2-D4, L2-D5 |
| **B3** | Initiation JSON `.../mass-transfers` (≤ 50) : valide + réserve + bulk-insert + `pending_approval` + idempotence requête | L2-D6, L2-D8, (L2-D20) |
| **B4** | Relais auto-replanifié (token bucket **batch-only**, SKIP LOCKED) + `ProcessTransferItemJob` (prefunded, retry via item) | L2-D9, L2-D10, L2-D11, L2-D12 |
| **B5** | Settlement : ajout event d'échec + `TransferItemSettledListener` (lookup `transaction_reference`, compteurs, agrégation) ; coupe la notif consumer par item | L2-D13, L2-D14, L2-D15 |
| **B6** | Réconciliation **générique money-core** (toute tx externe PENDING) + poll provider par kind ; `needs_review` | L2-D16, L2-D17, L2-D18 |
| ~~**B7**~~ | ~~Ingestion fichier XLSX~~ — **DIFFÉRÉ** (JSON seul au MVP) | L2-D19 |
| **B8** | Maker-checker : `pending_approval` → approve (`queued` + kick relais) / reject (`rejected` + `releaseHold`) ; séparation, self-approve owner | L2-D20, L2-D21, L2-D22 |
| **B9** | Présentation : **gate enterprise-only**, endpoints de lecture (`transactions:view`), DTO minimal ; notifs différées | L2-D23, L2-D24, L2-D25, L2-D26 |
| **B10** | Frais : pré-calcul par item (grille `transfert`), figés ; fee figée passée au prefunded | L2-D27, L2-D28 |

**Différé / évolutions** : ingestion XLSX (B7), gouverneur d'égress **partagé** interactif/batch (B4b —
MVP = batch-only), notifs d'approbation + synthèse de lot, colonne `held` (raccourci-C), service type
de frais dédié.

**États retenus au MVP.** `TransferBatchStatus` : `pending_approval, queued, processing, completed,
partial, failed, rejected, cancelled` (**omet** `ingesting`/`failed_ingestion` → B7). `TransferItemStatus` :
`queued, sending, sent, succeeded, failed, released, needs_review, cancelled`.

### Lot 1 — Design détaillé  *(validé 2026-07-20, type révisé 2026-07-21 → L1-D7)*

**Architecture.** Un seul nouveau module **produit** `aiglebusiness/payout` (présentation `client`),
**routeur mince** (miroir de `pay_merchant`). **Aucun** code argent core nouveau, **aucune** table.
Ajouts transverses minimes : décommenter `TransactionType.PAYOUT`.

**Endpoint.** `POST /api/business/organisations/{organisationId}/transfers`
Middlewares (canal business) : `geoip → businessChannel → auth → requireApp(AIGLEBUSINESS) →
businessDevice → orgPermission(payout:initiate)`.

**Flux** (`InitiatePayoutUseCase`, produit → core par service) :
1. `accountId = organisationId` (invariant account-centric).
2. Construit `ExternalOutCommand` : `type = TransactionType.TRANSFERT` (L1-D7), `destination = {msisdn, operator}`,
   `feeContext = { serviceTypeCode: TRANSFERT, paymentMethodCode: <mobile-money>, providerFromCode:
   <provider>, includeFees: false }`, `fromAccountId = accountId`, `initiatedBy = <membre uid>`,
   `idempotencyKey`, `metadata { deviceInfo, geoIpLocation, paymentMethodCode }`.
3. `engine.initiateExternalOut(cmd)` → débit gardé + transaction `PENDING` + Hub2. **Le contrôle des
   limites (le gate) vit ici** : `PartyValidator` lit le standing du compte et applique les plafonds
   `(segment, level)` — pas de gate produit (L1-D6).
4. Audit produit + réponse `202 { reference, status: pending }`.

**Frais.** La business paie (`total = montant + frais`), résolus par `FeeResolver` via `feeContext`
(grille `transfert`, L1-D4).

**Cycle async.** Réponse `PENDING` immédiate ; `SUCCESS`/`FAILED` (+ refund/recrédit sur échec) via
**webhook opérateur déjà branché** (`engine.settle` + controller webhook existants). Rien à ajouter.

**Gate = limites de transactions (L1-D6).** Aucun contrôle par segment. `PartyValidator` (dans
`external_out`) applique les limites du niveau : enterprise niveau 0 (plafonds `0`) → bloqué,
marchand → plafonné, enterprise niveau 2 → illimité.

**Erreurs** (toutes réutilisent l'existant) : dépassement de plafond → exceptions de limites
(`SingleLimitExceededException`, etc.) · permission absente → `403` (middleware `orgPermission`) ·
solde insuffisant → `InsufficientFundsException` (débit gardé, race-safe) · compte/wallet gelé →
`PartyValidator`.

**Tests** : `202` + débit + transaction `PAYOUT` (permission OK) · dépassement de limite → rejet ·
`403` sans `payout:initiate` · settlement webhook success / échec→refund (intégration, réutilise
l'existant) · frais = total débité.

**Hors scope Lot 1** (→ Lot 2, explicite) : maker-checker / approbation / seuil · tables
`payout_batch`/`payout_item` · ingestion fichier XLSX · mass-payout · relais outbox + gouverneur
d'égress · réconciliation cron · destination **interne** (`moveInternal`) · service type `payout` dédié.

### Découpage tracer-bullets — Lot 1  *(TDD, money réutilisé → produit d'abord)*
| # | Slice (comportement) | Test prioritaire |
|---|---|---|
| **L1-B1** | `InitiatePayoutUseCase` (mapping `ExternalOutCommand` **type TRANSFERT** — L1-D7, `engine.initiateExternalOut`) | unit : commande bien formée (type TRANSFERT, feeContext transfert, fromAccountId=org) ✅ |
| ~~**L1-B2**~~ | ~~Gate d'éligibilité ENTERPRISE L2~~ — **abandonné (L1-D6)** : pas de restriction par segment, les **limites** (`PartyValidator`, déjà testé) sont le gate | — |
| **L1-B3** | **Présentation** `aiglebusiness/payout` : route `POST …/transfers`, controller, validator, middlewares (dont `orgPermission(payout:initiate)`) | func HTTP : 202 PENDING + débit + tx PAYOUT ; 403 sans permission — 🟡 code en place, test HTTP à finir |
| **L1-B4** | **Settlement** — le décaissement **EST** un transfert (L1-D7) : réglé/remboursé par `settle_transfert` **sans cas spécial**. Gaps réels corrigés (indépendants du type) : `external_out` passe `accountId` (compte org, sinon `account_id` null) + corrige le **rollback inversé** (fuite de verrou). | func : succès→SUCCESS wallet inchangé ; échec→REFUNDED + recrédit ✅ |
| **L1-D-doc** | Swagger `business.yaml` : `POST …/transfers` (tag `Business - Transferts`, schémas `PayoutRequest`/`PayoutResponse`, 202/400/403/422) | ✅ |

## Existant réutilisé (rien à réinventer)
- **Engine** — toutes les primitives argent existent :
  `initiateExternalOut` (wallet → opérateur mobile money = **payout externe**), `moveInternal`
  (wallet → wallet Aigle = **payout interne**), settlement par webhook.
- **Pattern produit** — routeur mince (cf. `aiglesend/operations/transfert.usecase.ts`) :
  gardes auth → mapping commande → `engine.initiate*` → audit. À décliner côté business.
- **Permissions déjà cataloguées** (`aiglebusiness/membership/permissions.config.ts`) :
  `payout:initiate` (« Initier un paiement ou un paiement de masse », sensitive),
  `payout:approve` (« Approuver un paiement en attente (**maker-checker**) », sensitive),
  `provision:request`, `wallet:view`, `transactions:view`. **→ le maker-checker est déjà anticipé.**
- **Account-centric (R4 étape 2)** — `external_out`/`internal_move` résolvent le wallet par
  `account_id` ; un compte org (sans user) peut donc être **source** d'un mouvement.
- **Approvisionnement** — mocké côté admin ; le compte doit avoir du **solde** pour payer.
- **Queue asynchrone** (nouveau projet) — `@adonisjs/queue` **Redis** (`concurrency: 5`, driver
  `sync` en test) + pattern `Job<Payload>` (`execute`/`failed`, `.dispatch()`) déjà utilisé
  (webhooks, mail). **→ socle de l'exécution async performante et résiliente.**

### Legacy mass-payout (aiglebusiness/client-api) — repris pour le métier, refondu pour l'échelle
Un système existe (`app/actions/transactions/{init,retry}_mass_payout_transaction.ts`, modèle
`MassPayment` + transactions enfants, webhooks `payout/{success,failed}`, cron `verificationCron`).
Architecture **2 phases** : Phase 1 (DB atomique : parent + N enfants + frais pré-calculés), Phase 2
(réseau : **boucle séquentielle** sur chaque enfant → provider, résilience par enfant, webhook/retry).
**On garde le modèle métier** (parent `MassPayment` + enfants, statuts `pending/completed/partial/
failed/cancelled`, compteurs `expected/successful/failed`, frais persistés relus en phase 2,
succès partiel, réconciliation). **On refond la Phase 2** : la boucle séquentielle bloquante dans la
requête **plafonnée à 20** ne scale pas → on vise **des milliers** de bénéficiaires.

## Le nœud de cadrage
Un payout business diffère d'un transfert consumer sur 3 axes :
1. **Acteur ≠ titulaire** : c'est un **membre** (user, permission `payout:initiate`) qui initie
   pour le compte de l'**organisation** (source du mouvement). Auth = membre ; source = compte org.
2. **Séparation des tâches** : `initiate` puis `approve` (maker-checker) — deux personnes.
3. **Échelle** : le mass-payout est un **lot** de N transferts (orchestration async, succès partiel).

## Agenda (à ajuster en S1)

| Session | Sujet | État |
|---|---|---|
| **S1** | Cadrage + **architecture d'exécution** (performance/résilience) — le cœur | ✅ validée |
| S2 | Modèle de données : lot `payout_batch` + items `payout_item`, statuts, idempotence | ✅ validée |
| S3 | **Initiation** (rapide) : validation, **réservation de fonds**, bulk-insert, enqueue | ✅ validée |
| **S3b** | **Ingestion fichier** (voie principale gros lots) : upload → job de streaming → `ingesting` → réservation en fin | ✅ validée |
| S4 | **Exécution** async : relais outbox, gouverneur de débit, retries/backoff, isolation d'échec | ✅ validée |
| S5 | **Settlement & réconciliation** : webhooks par item, agrégation du lot, succès partiel, cron | ✅ validée |
| S6 | **Maker-checker** + transfert **unique** (interactif) + frais/limites/KYB | ✅ validée |
| S7 | Emplacement, enums, présentation `client`, events/notifs, migration, tracer-bullets + tests | 🟡 en cours |

---

## S1 — Cadrage + architecture d'exécution  *(proposition, à valider)*

### Objectif
La priorité affichée = **performance, rapidité, résilience** sur de **grands lots** (milliers de
bénéficiaires). S1 pose donc **l'architecture d'exécution** (le vrai enjeu), en plus du périmètre.

### Périmètre (rapide)
- **Une brique `payout`** couvrant **unique (N=1)** et **masse (N>1)** — un transfert unique est un
  lot à un item. Même chemin d'exécution, pas de code dupliqué.
- **Acteur ≠ source** : un **membre** (permission `payout:initiate`, auth aiglebusiness) initie ; la
  **source** est le **compte org** (`fromAccountId = organisationId`).
- **Destination** de départ : **externe** (mobile money, `initiateExternalOut`) — le cas réel
  paie/fournisseur ; l'**interne** (`moveInternal`) s'ajoute ensuite, même modèle.

### Architecture d'exécution — proposition (le cœur)
Découpler **initiation** (synchrone, rapide, bornée) de **l'exécution** (asynchrone, scalable) :

```
POST /payouts (batch)
  └─ INITIATION (requête, transaction DB courte) ──────────────────────────
       1. valide (org, membre, solde ≥ total+frais, taille lot)
       2. RÉSERVE les fonds : débit atomique du wallet org du montant total (hold)
       3. BULK-INSERT : payout_batch + N payout_item (status=queued) en masse
            (insertMany, PAS N transactions individuelles)
       4. ENQUEUE : un job par item (ou par shard) sur la queue Redis
       5. répond 202 { batchId, status: processing } immédiatement
                                                                       (ms, pas de réseau)
  └─ EXÉCUTION (workers queue, concurrency N) ────────────────────────────
       ProcessPayoutItemJob(itemId) :
         - idempotence : si item déjà terminal → skip (rejeu safe)
         - appelle engine.initiateExternalOut (débit déjà réservé → pas de re-débit)
         - marque item: sent (pending webhook) | failed
         - retries auto (backoff) sur erreur réseau ; échec définitif → failed
  └─ SETTLEMENT (webhook opérateur par item) ─────────────────────────────
         - success → item settled ; failed → item failed + LIBÈRE la réservation (recrédit)
         - met à jour les compteurs du batch (forUpdate, atomique)
         - dernier item terminal → agrège le statut du lot (completed/partial/failed)
  └─ RÉCONCILIATION (cron) ───────────────────────────────────────────────
         - items sent depuis > T sans webhook → poll statut provider / retry / expire
```

**Décisions structurantes proposées :**
- **D1 — Réservation de fonds à l'initiation** (débit du total en *hold*), pas un débit par item en
  Phase 2. Évite l'overspend et les races ; chaque échec **libère** sa part (recrédit). *(Diffère du
  legacy qui débitait par enfant en phase 2.)*
- **D2 — Bulk-insert** des items (`insertMany`), pas N `createTransaction` en boucle — clé pour
  ingérer un grand lot en un temps borné.
- **D3 — Un job par item** (fan-out) sur la **queue Redis**, exécutés avec **concurrency** + **retries/
  backoff** natifs. Isolation totale : un item qui échoue n'affecte aucun autre. *(Remplace la boucle
  séquentielle bloquante du legacy.)* Option **sharding** (1 job = K items) si le fan-out unitaire est
  trop chatty — à trancher en S4.
- **D4 — Idempotence par item** (clé stable `batchId:index`) : rejeu d'un job/webhook ne double
  jamais un paiement.
- **D5 — Agrégation du lot pilotée par les items** : le statut du batch (`completed/partial/failed`)
  est **dérivé** des compteurs mis à jour atomiquement au settlement, pas calculé en une passe.
- **D6 — Réutilise l'engine** : chaque item = un `initiateExternalOut` (mécanique argent, records,
  ledger, webhook **déjà** dans le core). Le produit orchestre le **lot**, le core exécute **l'unité**.

### Invariants
- **Aucune nouvelle mécanique argent** : l'unité de payout = primitive engine existante.
- **Account-centric** : source = `account_id` org ; le core ne connaît jamais `Organisation`.
- **Résilience** : succès partiel, retries, réconciliation ; **jamais** de double-paiement (idempotence).
- **Initiation bornée** : temps de réponse **indépendant de N** (bulk-insert + enqueue ; zéro réseau
  provider dans la requête).

### Points à trancher pour clore S1
- **P1** — Valides-tu l'**architecture d'exécution** (initiation rapide + réservation de fonds +
  bulk-insert + fan-out de jobs + settlement/réconciliation) comme colonne vertébrale ?
- **P2** — **Réservation de fonds** (D1 : hold du total à l'initiation, libération par échec) vs
  débit-par-item (legacy) — on part sur la réservation ?
- **P3** — Fan-out : **1 job/item** (simple, isolation max) au départ, avec **sharding** en option si
  besoin de débit — ou tu veux le sharding d'emblée ?
- **P4** — Le **transfert unique** est-il traité comme un **lot N=1** (reco : un seul chemin) ou une
  route/feature distincte plus simple ?
- **P5** — L'agenda S2–S7 (données → initiation → exécution → settlement → maker-checker/frais →
  intégration) te convient-il ?

### Décisions S1  *(validées 2026-07-11)*
- **Périmètre** : une brique **`payout`** couvrant unique (N=1) **et** masse (N>1) — un transfert
  unique = un lot à un item, **même chemin d'exécution**.
- **Acteur ≠ source** : un **membre** (permission `payout:initiate`, auth aiglebusiness) initie ; la
  **source** est le **compte org** (`fromAccountId = organisationId`).
- **Destination** de départ : **externe** (mobile money, `POST /transfers` Hub2 via
  `initiateExternalOut`) ; l'interne (`moveInternal`) s'ajoute ensuite.
- **Archi = découpler initiation (rapide, bornée) / exécution (async, scalable)**. Réponse `202`
  indépendante de N.
- **D1** — **Réservation de fonds** à l'initiation : **hold ledger** du total (débit unique), pas de
  débit par item. Chaque échec **libère** sa part (recrédit ledger).
- **D2** — **Bulk-insert** des items (`insertMany`), pas N `createTransaction` en boucle.
- **D3** — **Relais outbox** (pas de fan-out naïf) : tire les items dus par batch, les relâche vers
  Hub2 au **débit contrôlé**, isolation d'échec par item.
- **D4** — **Idempotence** : clé au **niveau requête** (rejeu du POST ≠ double lot) **et** par **item**
  (`batchId:index` → rejeu job/webhook ≠ double-paiement).
- **D5** — Statut du lot **dérivé** des compteurs (`successful/failed`) mis à jour atomiquement
  (`forUpdate`) au settlement.
- **D6** — **Réutilise l'engine** : chaque item = un `initiateExternalOut` (records, ledger, webhook
  déjà dans le core). Le produit orchestre le **lot**, le core exécute **l'unité**.
- **D7** — **Gouverneur d'égress PARTAGÉ** (pas spécifique au mass-payout) : un **token bucket Redis**
  (limite Hub2 **par IP**, ≈ **7 req/s**, marge sous 75/10s) placé **devant l'adaptateur Hub2**, que
  **tout** `POST /transfers` doit franchir — **transferts consumer + payouts uniques + items mass**
  partagent le même budget per-IP. **Deux voies de priorité** : *interactif* (consumer transfer,
  payout unique — l'utilisateur attend) sert **en premier** ; *batch* (items mass) prend le **budget
  résiduel** et **cède le pas**. Un appel recalé sur budget : interactif → attente courte / `queued`
  léger ; item mass → reste `queued`, drainé au tick suivant. *(Prod = une IP de sortie → un bucket ;
  multi-IP → budget × nombre d'IP.)*
  - **Deux rôles distincts à ne pas confondre** : (a) **outbox de fiabilité** (rien perdu à l'enqueue)
    = mass + payout unique (modèle async) ; (b) **gouverneur de débit** (token bucket) = **tout**
    l'égress `POST /transfers`, consumer inclus. Le relais outbox **consomme** des tokens du bucket
    partagé, en voie *batch*.
- **D8** — **Réconciliation webhook-first** (Hub2 le recommande ; secrets + controller déjà là) ;
  polling `GET /transfers/:id/status` (5/5s **par ID**) uniquement pour les items `sent` orphelins > T.
- **Outbox = fiabilité + rate-limit + retry** en un composant ; réutilise le **pattern outbox
  d'aiglehub** (`enqueue`/`dispatchNow`/`processPending`, backoff, dead letter), appliqué aux
  `payout_item`. La **classification d'erreur** (retryable/terminal) existe déjà (`hub2_error_map`).
- **Réf. rate limits Hub2** : `POST /transfers` 75/10s ; `GET /:id/status` 5/5s par ID ;
  `GET /transfers` 1/30s ; global 50/5s — **par IP**, sandbox = live.

---

## S2 — Modèle de données  *(proposition, à valider)*

### Où vivent le lot et les items ? (la vraie question d'archi)
Par analogie avec **`checkout`** (« un checkout, c'est de l'argent, pas du QR » → contexte core
`core/money/checkout`), un **payout est de l'argent** → **contexte core `core/money/payout`** :
- **Core `core/money/payout`** : modèles `PayoutBatch` + `PayoutItem`, réservation, exécution (jobs +
  relais outbox), settlement, réconciliation — l'**orchestration argent** (réutilisable, testable).
- **Produit `aiglebusiness/payout`** (présentation `client`) : l'API, l'**auth** (membre +
  `payout:initiate`), le **maker-checker**, la résolution `org → account` ; appelle le **service core
  payout** (produit → core par service). Le core ne connaît **jamais** `Organisation`.

### `payout_batch` (le lot)
| Colonne | Type | Rôle |
|---|---|---|
| `id` (uuid) | pk | |
| `reference` | string unique | référence métier (`payout_xxx`) |
| `account_id` | uuid indexé | **compte source** (org) — account-centric, pas d'`organisation_id` en core |
| `initiated_by` | string | user (membre) initiateur — traçabilité |
| `label` / `description` | string | « Salaires Juillet » |
| `total_amount` / `fees` / `currency` | | montant réservé (hold) |
| `expected_count` | int | N items |
| `successful_count` / `failed_count` | int | compteurs (atomiques au settlement) → dérivent le statut |
| `status` | enum | machine à états du lot (ci-dessous) |
| `idempotency_key` | string unique nullable | clé requête (rejeu du POST → même lot) |
| `reservation_ref` | string nullable | réf. de l'écriture ledger de **hold** (D1) |
| `created_at` / `updated_at` | | |

**États du lot** : `pending_approval` (maker-checker) → `queued` → `processing` →
`completed` / `partial` / `failed` ; `rejected` / `cancelled` (avant exécution). Dérivé des compteurs.

### `payout_item` (le bénéficiaire — unité d'exécution)
| Colonne | Type | Rôle |
|---|---|---|
| `id` (uuid) | pk | |
| `batch_id` | fk indexé | lot parent |
| `idempotency_key` | string unique | **`batchId:index`** (D4) — anti double-paiement |
| `sequence` | int | position dans le lot |
| `amount` / `fees` / `currency` | | montant net + frais **pré-calculés** (relus, pas recalculés) |
| `recipient_name` / `recipient_phone` / `operator` / `country` | | destination mobile money |
| `status` | enum | machine à états de l'item (ci-dessous) |
| `transaction_reference` | string nullable | **lien vers la transaction core** créée par `initiateExternalOut` |
| `provider_reference` | string nullable | id Hub2 (transfert) |
| `failure_reason` | string nullable | motif d'échec (item terminal) |
| `attempts` | int | tentatives (retry/backoff) |
| `next_retry_at` | datetime nullable | planification (relais outbox, style aiglehub) |
| `settled_at` / `created_at` / `updated_at` | | |

**Machine à états de l'item** (explicite, pas de booléens) :
```
queued ─▶ sending ─▶ sent ─▶ succeeded        (webhook success)
   │         │         └────▶ failed  ─▶ released   (webhook failed → libère la réservation)
   │         └────────────────▶ failed  ─▶ released   (erreur terminale à l'envoi)
   └─(annulé avant envoi)─────▶ cancelled ─▶ released
```
- `queued` : inséré, en attente de relâche par le relais (throttle).
- `sending` : `POST /transfers` en cours (verrou idempotent).
- `sent` : accepté par Hub2 (pending), en attente webhook.
- `succeeded` : webhook success → capture définitive de la part réservée.
- `failed` : erreur terminale (envoi ou webhook) → `released` (recrédit de la part).

### Réservation & ledger (lien D1)
- À l'initiation : **une** écriture ledger de **hold** = `total_amount + fees` débités du wallet org ;
  `payout_batch.reservation_ref` la référence.
- Par item : succès = capture (la part reste débitée) ; échec/annulation = **release** (recrédit de la
  part). Invariant : `hold == Σ succeeded + Σ released` à la fin. *(Détail des écritures = S3/S5.)*

### Idempotence (lien D4)
- **Requête** : `payout_batch.idempotency_key` unique → un rejeu du POST renvoie le lot existant, ne
  ré-insère rien, ne re-réserve rien.
- **Item** : `payout_item.idempotency_key = batchId:sequence` unique → un rejeu de job/webhook ne
  crée jamais un 2e `initiateExternalOut` ni un 2e crédit.

### Points à trancher pour clore S2
- **P1** — Emplacement : **core `core/money/payout`** + produit mince `aiglebusiness/payout` (reco,
  miroir de `checkout`) — ou tu veux tout côté produit (comme le legacy) ?
- **P2** — Le schéma `payout_batch` / `payout_item` (colonnes, compteurs, `reservation_ref`,
  `idempotency_key`, `next_retry_at`) te convient-il ? Manque-t-il un champ (ex. `scheduled_at` pour
  un payout programmé, `approved_by` pour le maker-checker) ?
- **P3** — **Relation item ↔ transaction core** : l'item **référence** la transaction créée par
  l'engine (`transaction_reference`), la transaction restant la source comptable — OK ? (vs dupliquer
  les montants/état dans l'item).
- **P4** — Les **machines à états** (lot : pending_approval→queued→processing→completed/partial/failed ;
  item : queued→sending→sent→succeeded/failed→released) sont-elles complètes ?

### Décisions S2  *(validées 2026-07-11)*
- **P1 → core** : `core/money/payout` (modèles + orchestration argent) + produit mince
  `aiglebusiness/payout` (auth, maker-checker, résolution org→account). Miroir de `checkout`.
- **P2 → schéma validé** (`payout_batch` + `payout_item` tels que décrits).
- **P3 → item référence la transaction core** (`transaction_reference`) ; la transaction reste la
  source comptable.
- **P4 → machines à états validées** (lot + item).

---

## S3 — Initiation (rapide, bornée)  *(proposition, à valider)*

### Objectif
L'initiation doit être **rapide et de temps borné** (indépendant de N) : **une transaction DB courte**,
**zéro appel réseau provider**, puis réponse `202`. Le vrai enjeu = la **mécanique de réservation**
(éviter le double-débit relevé ci-dessus).

### Le flux d'initiation
```
POST /payouts  (produit aiglebusiness → service core payout)
 ── PRÉ (hors transaction) ────────────────────────────────
   1. Idempotence requête : si `idempotency_key` déjà vue → renvoie le lot existant (STOP).
   2. Validation produit : membre a `payout:initiate` ; résout org → account_id (source).
   3. Validation core : compte + wallet actifs ; taille du lot ≤ cap ; N > 0.
   4. Frais PRÉ-CALCULÉS par item (une passe) → total = Σ(amount) ; totalDébit = total + Σ(fees).
 ── TRANSACTION DB (courte, atomique) ─────────────────────
   5. RÉSERVE : débit GARDÉ du wallet org de `totalDébit`  (UPDATE WHERE balance ≥ totalDébit
        → lève InsufficientFunds si insuffisant). ⇒ check-de-solde ET réservation = **un seul acte
        atomique** (pas de TOCTOU). Écriture ledger de hold → `reservation_ref`.
   6. BULK-INSERT : `payout_batch` (status = `pending_approval` OU `queued` selon maker-checker, S6)
        + N `payout_item` (status = `queued`, frais figés, `idempotency_key = batchId:sequence`)
        en **`insertMany`** (pas N inserts).
   7. OUTBOX : insère les intentions d'exécution **dans la même transaction** (atomique avec les
        items) — sauf si `pending_approval` (on n'enfile qu'après approbation).
   8. COMMIT.
 ── POST-COMMIT ───────────────────────────────────────────
   9. Réponse `202 { batchId, reference, status, expected_count }` (ms).
      Le relais outbox draine ensuite au débit gouverné (D7) — hors requête.
```

### Mécanique de réservation — le choix clé (éviter le double-débit)
`initiateExternalOut` débite le wallet à chaque appel. Si le lot réserve le total **et** que chaque
item rappelle `initiateExternalOut`, on débite 2×. Trois options :

- **A — Réserver le total, items PRÉ-FINANCÉS (reco).** Le lot débite `totalDébit` une fois (réservation).
  Chaque item exécute un external-out **sans re-débiter** le wallet (fonds déjà réservés) : il crée la
  transaction + ledger + appel Hub2, mais **saute la jambe de débit**. Nécessite un **mode pré-financé**
  sur l'engine (`initiateExternalOut({ prefunded: true })` ou primitive dédiée). **Garantit** que tout
  le lot est financé dès l'acceptation (aucun « insufficient funds » en cours de route). Échec d'un
  item → **release** (recrédit de sa part) ; l'invariant `hold == Σ succeeded + Σ released` tient.
- **B — Pas de réservation ; débit gardé par item (legacy).** Simple, mais entre l'acceptation et le
  drain (~min), une dépense concurrente peut vider le wallet → des items échouent en cours. Pas de
  garantie de financement du lot. **Rejeté** (fragile pour un décaissement).
- **C — Hold explicite (`held`/`available`).** Colonne `held` sur le wallet ; `available = balance −
  held`. Le plus « propre » comptablement, mais touche toute la logique de solde partout. **Sur-
  dimensionné pour ce lot** ; à considérer si un vrai modèle de hold devient nécessaire ailleurs.

→ **Reco A** : réservation = **un débit gardé du total**, items pré-financés, release par échec.

### Idempotence & résilience à l'initiation
- **Requête** : `payout_batch.idempotency_key` unique → rejeu du POST = renvoie le lot, **ne re-réserve
  pas** (pas de double débit du total).
- **Panne après commit, avant relâche** : les intentions outbox sont **committées avec** les items →
  le relais les reprend. Rien perdu, rien enfilé en double.
- **Panne pendant la transaction** : rollback total → réservation annulée, aucun item, aucune intention.

### Points à trancher pour clore S3
- **P1** — **Mécanique de réservation** : option **A** (réserver le total, items pré-financés — reco),
  **B** (débit par item), ou **C** (hold explicite) ?
- **P2** — Réservation = **débit gardé du total** (check-solde + réserve atomiques en un acte) — OK,
  ou tu veux un contrôle de solde séparé d'abord ?
- **P3** — **Cap de taille** d'un lot (le legacy = 20). On vise « milliers » : plafond dur (ex. 5 000 /
  10 000 par lot) + **chunking** au-delà, ou pas de cap (borné seulement par le solde) ?
- **P4** — **Outbox-in-transaction** (intentions insérées dans la même transaction que les items) —
  confirmé comme mécanisme d'enqueue fiable ?
- **P5** — Branche **maker-checker** : à l'initiation, le lot naît `pending_approval` (si requis) et
  n'enfile qu'après `approve` ; sinon `queued` direct. On garde cette branche (détail en S6) ?

### Décisions S3  *(validées 2026-07-11)*
- **P1 → option A** : réserver le total à l'initiation, **items pré-financés** (chaque item exécute un
  external-out **sans re-débiter** le wallet). Garantit le financement du lot dès l'acceptation.
- **P2 → débit gardé du total** : check-solde + réservation en **un acte atomique** (UPDATE WHERE
  balance ≥ totalDébit → InsufficientFunds sinon).
- **P3 → voie fichier async = chemin principal** ; JSON `recipients[]` = confort petits lots. **Même
  pipeline** dessous. Parsing en **présentation produit**, jamais dans le core. (Détail → S3b.)
- **P4 → outbox-in-transaction** : les intentions d'exécution sont insérées **dans la même
  transaction** que les items (enqueue fiable, zéro perte).
- **P5 → branche maker-checker** : le lot naît `pending_approval` (si requis), n'enfile qu'après
  `approve` ; sinon `queued` direct. (Détail → S6.)

### Raffinement — deux entrées d'ingestion (validé 2026-07-11)
Un mass-payout accepte **deux entrées de premier rang** depuis l'UI, qui convergent vers le **même**
`payout_batch`/`payout_item` et le **même pipeline** (réservation, maker-checker, relais, settlement,
réconciliation) :
1. **Liste manuelle** — l'utilisateur saisit/ajoute des bénéficiaires → `POST /payouts`
   `recipients[]` (JSON) → items **bulk-insérés synchrone** dans la requête (N ≤ cap).
2. **Fichier XLSX** — upload → `POST /payouts/upload` → items via **ingestion async streamée** (gros N).
Le chemin **interactif** (D-exec-6) reste réservé au **transfert unique (N=1)** ; une **liste manuelle
de N > 1 est un mass-payout** (batch pipeline), pas le chemin interactif.

### Décisions S3b  *(validées 2026-07-11)*
- **P1b → XLSX** : format d'entrée `.xlsx`. ⚠️ Impose un **parseur XLSX en streaming** (lib type
  `exceljs` streaming reader / `xlsx-stream-reader`) qui lit ligne par ligne **sans** charger tout le
  classeur en RAM — préserve l'invariant streaming.
- **P2b → strict all-or-nothing** : une ligne invalide → **tout le fichier rejeté** (`failed_ingestion`
  + rapport d'erreurs), rien réservé. On ne paie jamais un fichier partiellement valide.
- **P3b → parsing en présentation produit** : le job produit lit le `.xlsx` et appelle
  `core.appendItems`/`finalize` avec des items **structurés** ; le core ne voit jamais le fichier.
- **P4b → réservation en fin d'ingestion** + états `ingesting → (failed_ingestion | rejected | queued)`.

---

## S3b — Ingestion fichier (async)  *(proposition, à valider)*

### Objectif
Ingérer un **gros fichier** (paie de milliers) **sans** bloquer, sans tout charger en RAM, sans gros
JSON. Un fichier = **un lot logique** (une réservation, une approbation, un suivi).

### Le flux d'ingestion
```
POST /payouts/upload   (multipart : fichier Excel/CSV)          [présentation produit aiglebusiness]
  1. valide le fichier (type, taille max) ; stocke en **temp** (Drive/S3)
  2. crée `payout_batch` status = `ingesting` (expected_count=0, PAS de réservation)
  3. dispatch IngestPayoutFileJob(batchId, fileRef)
  4. répond 202 { batchId, status: ingesting }                  (ms)

IngestPayoutFileJob  (produit : lit le fichier ; appelle le service core par tranches)
  - **streame** le fichier ligne par ligne (jamais tout en mémoire)
  - valide chaque ligne (tel, opérateur, montant, nom) ; **collecte les erreurs de ligne**
  - core.appendItems(batchId, chunk) par tranches (~500-1000) : insert items (status=queued),
      frais pré-calculés, `idempotency_key = batchId:sequence` ; met à jour expected_count + total
  - à la FIN → core.finalize(batchId) :
      • fichier invalide (erreurs > seuil / 0 ligne valide) → `failed_ingestion` (+ rapport), rien réservé
      • sinon → RÉSERVE le total (débit gardé) :
            solde OK          → `queued` (ou `pending_approval`) + enqueue outbox
            solde insuffisant → `rejected` (rien envoyé)
  - supprime/archive le fichier temp

GET /payouts/:batchId  → état (ingesting / queued / processing / completed / partial) + rapport lignes
```

### Décisions structurantes
- **Le core ne voit jamais le fichier.** L'ingestion (lecture + parsing Excel/CSV) est **produit** ;
  elle appelle le service core `appendItems`/`finalize` avec des **items structurés**. Le domaine
  argent reste pur.
- **Réservation en FIN d'ingestion** (le total n'est connu qu'après lecture complète) — pas à l'upload.
- **Streaming + insert chunké** : ni gros JSON, ni gros INSERT, ni tout en RAM → taille quasi
  illimitée.
- **États d'ingestion** : `ingesting → (failed_ingestion | rejected | queued)`. `failed_ingestion` =
  fichier invalide (rien débité) ; `rejected` = fichier OK mais solde insuffisant.

### Points à trancher pour clore S3b
- **P1b** — **Formats** : CSV seul (le client convertit l'Excel, streaming trivial) — ou **CSV + XLSX**
  (le back streame le `.xlsx`, nécessite une lib de parsing streaming) ? *(reco : CSV d'abord, XLSX
  ensuite si besoin — le frontend sait déjà lire l'Excel.)*
- **P2b** — **Validation** : **strict all-or-nothing** (une ligne invalide → tout le fichier rejeté,
  rapport d'erreurs — **le plus sûr pour une paie** : on ne veut pas payer 9 998 et en droper 2 en
  silence) — ou **lenient** (ingère les valides, rapporte les invalides) ? *(reco : strict.)*
- **P3b** — **Parsing dans la présentation produit** (job produit lit le fichier → `appendItems`/
  `finalize` core) — confirmé, le core jamais exposé au fichier ?
- **P4b** — **Réservation en fin d'ingestion** + états `ingesting/failed_ingestion/rejected/queued` —
  validés ?

## S4 — Exécution async  *(proposition, à valider)*

### Objectif
Drainer les items d'un lot `queued` vers Hub2 **au débit gouverné** (D7), avec **isolation d'échec**,
**retries** et **zéro double-paiement** — sans jamais bloquer ni écraser l'agrégateur.

### Le relais (le moteur de cadence) — modèle aiglehub `processPending`
Un **relais planifié** (job récurrent, ex. toutes les 1-2 s) est le **point unique de cadence** :
```
PayoutRelayJob (tick)                                    [core/money/payout]
  1. combien de tokens dispo ce tick ? (bucket Redis partagé, voie BATCH — cède à l'interactif, D7)
  2. tire les items DUS par lot : status=`queued` OU (`sent`/retry avec next_retry_at ≤ now),
       LIMIT = min(tokens_dispo, OUTBOX_BATCH_SIZE)   (SKIP LOCKED pour éviter les doublons multi-worker)
  3. pour chacun → dispatch ProcessPayoutItemJob(itemId)   (token « consommé »)
  4. les items sans token restent `queued` → tick suivant  (backpressure naturelle)
```
→ Le relais **ne relâche que ce que le budget permet** ; la file ne se remplit jamais de milliers de
jobs qui matraqueraient Hub2. La priorité interactif > batch vit dans l'allocation de tokens (D7).

### L'unité d'exécution — `ProcessPayoutItemJob`
```
ProcessPayoutItemJob(itemId)                             [core/money/payout]
  a. IDEMPOTENCE : recharge l'item ; si terminal (succeeded/failed/settled) → SKIP (rejeu safe).
  b. VERROU : status queued → sending (UPDATE gardé WHERE status='queued' ; sinon un autre worker
       l'a déjà pris → SKIP).
  c. ENGINE (pré-financé, P1=A) : engine.initiateExternalOut({ ..., prefunded: true })
       → crée la transaction core + ledger + POST /transfers Hub2 (SANS re-débiter le wallet).
       - accepté (pending)      → item `sent`, provider_reference = id Hub2 → attend le webhook (S5)
       - erreur DÉFINITIVE      → item `failed` + RELEASE (recrédit de la part réservée)
       - erreur RETRYABLE (429/net) → throw → retry (attempts++, next_retry_at = backoff) ; l'item
            reste repris par le relais au prochain tick dû
  d. après MAX_ATTEMPTS → item `failed` (dead letter) + RELEASE + surface en revue.
```

### Décisions structurantes
- **D-exec-1** — **Relais planifié** (pas de fan-out immédiat de N jobs) : un tick tire les items dus
  et n'en dispatch que **`min(tokens, batch_size)`**. La cadence = le relais, pas la concurrency brute.
- **D-exec-2** — **Mode pré-financé** de l'engine (P1=A) : `initiateExternalOut({ prefunded: true })`
  saute la **jambe de débit** (fonds déjà réservés), garde record + ledger + provider. *(Petite
  extension de l'engine, pas une nouvelle mécanique.)*
- **D-exec-3** — **Anti-doublon multi-worker** : sélection `... FOR UPDATE SKIP LOCKED` au relais +
  verrou `queued→sending` gardé au job → un item n'est jamais traité 2× en parallèle.
- **D-exec-4** — **Retry/backoff** réutilise la politique aiglehub (exponentiel, `next_retry_at`,
  MAX_ATTEMPTS → dead letter). La **classification** definitive/retryable vient déjà de Hub2
  (`hub2_error_map`) — le job réagit, ne re-classe pas.
- **D-exec-5** — **Token consommé au relais** (dispatch seulement des jobs token-backed), pas dans le
  job. Simple et suffisant pour le pacing ; le bucket se recharge au débit Hub2 (~7/s).

### Points à trancher pour clore S4
- **P1** — **Relais planifié** (tick tire les items dus + dispatch token-backed — reco, modèle
  aiglehub) vs **fan-out immédiat** (tous les jobs dès l'initiation, self-throttle par token) ?
- **P2** — **Mode pré-financé** : un **flag `prefunded`** sur `initiateExternalOut` (saute le débit) —
  ou une **primitive dédiée** `initiatePrefundedExternalOut` ? *(reco : flag, moins de duplication.)*
- **P3** — **Token consommé au relais** (D-exec-5, reco) vs **dans le job** (chaque job acquiert avant
  Hub2, plus précis mais plus complexe) ?
- **P4** — **Politique de retry** : réutiliser le backoff aiglehub `(2^n−1)×60s` / MAX 10 (~34h) — ou
  une politique **plus serrée** pour un payout (ex. base 30s, MAX 6, dead letter à ~2-4h) ?
- **P5** — **Dead letter** : après MAX_ATTEMPTS → `failed` + release + **exposé en revue** (liste des
  items dead-letter du lot) pour action manuelle — OK ?

### Décisions S4  *(validées 2026-07-11)*
- **P1 → relais planifié** (tick tire les items dus + dispatch token-backed ; modèle aiglehub
  `processPending`). La cadence = le relais, pas la concurrency brute.
- **P2 → flag `prefunded`** sur `initiateExternalOut` (saute la jambe de débit ; fonds déjà réservés).
- **P3 → token consommé au relais** (dispatch uniquement des jobs token-backed).
- **P4 → politique de retry serrée (payout)** : base 30 s, backoff exponentiel, **MAX ~6** (dead letter
  à ~2-4 h) plutôt que le ~34 h d'aiglehub — un payout ne doit pas rester coincé une journée ; la
  réconciliation (S5) prend le relais. *(Valeurs ajustables à l'implémentation.)*
- **P5 → dead letter exposé** : après MAX_ATTEMPTS → item `failed` + release + **listé en revue**
  (items dead-letter du lot) pour action manuelle.
- **D-exec-6 — DEUX MODES D'EXÉCUTION.** *Interactif* (payout **unique**, transfert consumer — un
  humain attend) = **synchrone inline** : `initiateExternalOut` **direct dans la requête** (token voie
  **interactif**/priorité), réponse **immédiate**, **sans** réservation-hold **ni** relais. *Batch*
  (items d'un mass-payout) = **async via relais** (token voie **batch**/résiduel). **Le relais (S4) ne
  concerne QUE le mode batch.** Le « single = batch N=1 » de S1 vaut au niveau **données/reporting**,
  pas à l'exécution.

---

## S5 — Settlement & réconciliation  *(proposition, à valider)*

### Objectif
Résoudre chaque item **envoyé** (webhook Hub2), **agréger** le lot (succès partiel), **libérer** les
parts des échecs, et garantir qu'**aucun item ne reste bloqué** (réconciliation) — le tout **idempotent**.

### Settlement par item (webhook-first)
```
Webhook Hub2 (transfer.success / transfer.failed)  →  controller (signature vérifiée, déjà là)
  → engine.settle({ reference, kind, outcome })         [CORE money : l'ARGENT]
       success → transaction `success` (part réservée = capturée, rien à faire côté solde)
       failed  → transaction `failed` + REFUND = **release** (recrédit de amount+fees au wallet)
       (idempotent : rejeu webhook → skip si déjà terminal)
  → émet un event de settlement
       → PayoutItemSettledListener  [CONTEXTE payout : le SUIVI du lot]
            - item → `succeeded` | `failed` (+ failure_reason), settled_at
            - incrémente batch.successful_count / failed_count  (UPDATE ... FOR UPDATE, atomique)
            - si successful + failed == expected → **agrège** le statut du lot :
                 tous succès → `completed` · quelques échecs → `partial` · tous échecs → `failed`
```
**Séparation des concerns** : le **core settle** fait l'**argent** (état transaction + release =
refund standard sur échec) ; le **contexte payout** fait le **suivi** (item + compteurs + statut du
lot) via l'**event de settlement**. Le release réutilise le **refund existant** — pas de nouvelle
mécanique.

### Invariant de fonds (vérifié)
```
réservation (hold) = Σ tous les (amount+fees)                     [débit total à l'initiation]
item succès        = rien de plus (part déjà « dépensée »)
item échec         = release = recrédit de sa part
─────────────────────────────────────────────────────────────────
débit net final    = Σ (amount+fees) des items SUCCÈS             ✅ l'org ne paie que les réussis
```

### Réconciliation (le filet — jamais la source unique)
- **Cron** (ex. toutes les 5-10 min) : sélectionne les items `sent` avec `settled_at IS NULL` et
  `updated_at < now − T` (T ≈ 15-30 min sans webhook).
- **Poll** `GET /transfers/:id/status` (Hub2 = **5 req/5s PAR ID**, D8) → terminal ? settle comme un
  webhook (même chemin idempotent) ; toujours pending → laisse ; très ancien → **escalade** (revue).
- **Webhook-first** (Hub2 le recommande) : le cron ne fait que rattraper les webhooks perdus/désordonnés.

### Cas ambigu (le paiement a peut-être réussi)
- Sévérité **ambiguous** (Hub2) → **ne PAS release** (risque de double-crédit si le paiement est en
  fait passé) → item en `needs_review`, résolu par réconciliation/polling ou action manuelle.

### Points à trancher pour clore S5
- **P1** — Settlement = **core settle (argent) + event → listener payout (suivi)** (reco, séparation
  des concerns) — ou un settle **payout-aware** unique ?
- **P2** — **Release = le refund standard** de settle-échec (recrédit de la part de l'item),
  l'invariant de fonds tient — confirmé ?
- **P3** — **Réconciliation** : cron 5-10 min, seuil T ≈ 15-30 min, poll `GET /:id/status` (5/5s par
  ID) — cadence/seuils OK ?
- **P4** — **Ambigu** → `needs_review` (pas de release, revue) — OK ?
- **P5** — **Fin de lot** : notifier l'initiateur + produire un **rapport de settlement**
  (réussis / échoués + montants, part libérée) ? (notif scopée `aiglebusiness`, cf. R2)

### Décisions S5  *(validées 2026-07-11)*
- **P1 → core settle (argent) + event → listener payout (suivi)** : séparation des concerns.
- **P2 → release = refund standard** de settle-échec ; invariant « l'org ne paie que les réussis » tient.
- **P3 → réconciliation** cron 5-10 min, seuil T ≈ 15-30 min, poll `GET /:id/status` (5/5s par ID),
  webhook-first.
- **P4 → ambigu → `needs_review`** (pas de release, anti double-crédit).
- **P5 → fin de lot** : notif initiateur (scopée `aiglebusiness`) + **rapport de settlement**
  (réussis/échoués + montants + part libérée).

---

## S6 — Maker-checker + transfert unique + frais/limites/KYB  *(proposition, à valider)*

### A. Maker-checker (`payout:initiate` / `payout:approve`)
```
Membre A (payout:initiate) initie un mass-payout
  → ingestion → réservation (hold) → batch `pending_approval`   (fonds DÉJÀ tenus)
Membre B (payout:approve, ≠ A) :
  approve → batch `queued` + enqueue outbox → exécution (S4)
  reject  → batch `rejected` + RELEASE (recrédit du hold)
```
- **Réservation AVANT approbation** : le hold est posé dès l'initiation/ingestion → l'approbateur sait
  que **les fonds sont là** ; rejet → release. (Alternative « réserver à l'approbation » rejetée :
  l'approbation pourrait échouer faute de solde.)
- **Séparation des tâches** : `approve` par un membre **≠** l'initiateur (`payout:approve` distinct de
  `payout:initiate`). Cas **owner seul** : self-approve toléré (petite org) — à confirmer.
- **Déclencheur** : approbation **toujours** pour un mass-payout ; **seuil** configurable pour router
  aussi les gros montants unitaires vers l'approbation — à trancher.

### B. Transfert unique (interactif — D-exec-6)
- Chemin **synchrone inline** : `initiateExternalOut` direct, réponse immédiate, pas de relais.
- **Approbation ?** MVP : un membre `payout:initiate` fait un transfert unique **direct** (pas de
  maker-checker) **sous un seuil** ; au-dessus du seuil → route vers `pending_approval` (même workflow
  A). → cohérent : petit = immédiat, gros = double-contrôle.

### C. Frais
- **La business paie les frais** (comme le legacy : `totalDébit = Σ montant + Σ frais`).
- **Service type catalogue dédié `payout`** (comme `checkout` a le sien) : tarifs business propres,
  clé `(payout × mobile-money × provider)` dans le SPM. Frais **pré-calculés** par item à l'ingestion,
  **figés**, relus (pas recalculés). `TransactionType.PAYOUT` (décommenter l'enum).

### D. Limites / KYB
- **Gate KYB** : un compte org doit être **vérifié** pour envoyer. `OrganisationLevel.LEVEL_0` =
  restreint → **payout bloqué** ; `LEVEL_1`/`LEVEL_2` autorisés.
- **Validation account-centric** : réutilise `PartyValidator` (compte + wallet actifs, statut). Les
  **plafonds granulaires** (single/daily/monthly d'envoi par niveau) dépendent de **[[R5]]** (paliers
  portés par le compte — pas encore construit) → MVP : **gate sur le niveau** (L1+), plafonds fins
  **différés à R5**. *(Un compte marchand qui envoie hérite des limites de son niveau KYB quand R5 sera là.)*

### Points à trancher pour clore S6
- **P1** — **Déclencheur maker-checker** : approbation **toujours** pour un mass-payout (reco) +
  **seuil configurable** (montant) pour router aussi les gros unitaires — ou autre règle (jamais,
  toujours, par rôle) ?
- **P2** — **Séparation des tâches** : `approve` ≠ initiateur (enforced) ; **owner seul → self-approve**
  toléré ? (sinon une org à 1 personne ne peut jamais approuver.)
- **P3** — **Transfert unique** : direct sous un **seuil**, au-dessus → approbation (reco) — ou single
  toujours direct / toujours soumis à approbation ?
- **P4** — **Frais** : business paie via service type **`payout`** dédié (catalogue), `TransactionType.
  PAYOUT` — confirmé ?
- **P5** — **KYB** : gate sur `LEVEL_1+` (L0 bloqué), plafonds fins **différés à R5** — OK, ou tu veux
  des **caps de base** dès le MVP (ex. plafond unitaire/journalier en dur par niveau) ?

### Décisions S6  *(validées 2026-07-11)*
- **P1 → maker-checker** : approbation **toujours** pour un mass-payout + **seuil configurable**
  (montant) qui route aussi les gros unitaires vers l'approbation.
- **P2 → séparation des tâches** : `approve` par un membre **≠** l'initiateur ; **owner seul →
  self-approve toléré** (org à une personne).
- **P3 → transfert unique** : direct sous seuil (interactif inline) ; au-dessus du seuil → workflow
  d'approbation.
- **P4 → frais** : business paie via service type catalogue **`payout`** dédié ; `TransactionType.PAYOUT`.
- **P5 → KYB** : gate sur le **niveau** ; plafonds fins **différés à [[R5]]**.
- **⭐ Règle d'éligibilité (2026-07-11)** : ~~seule une ENTREPRISE vérifiée (KYB, `LEVEL_2`) fait du
  payout ; MARCHAND receive-only~~. **⚠️ SUPERSÉDÉE le 2026-07-20 (voir L1-D6)** : **pas de
  restriction par segment** — marchand comme entreprise peuvent décaisser, le **gate = les limites de
  transactions** du compte (`PartyValidator`). Un compte trop bas (enterprise niveau 0 = plafonds 0)
  est **bloqué par ses limites**, pas par une règle de segment.

---

## S7 — Intégration : emplacement, enums, migration, tracer-bullets  *(proposition, à valider)*

### Emplacement (récap)
- **Core `core/money/payout`** : modèles `PayoutBatch`/`PayoutItem` ; services (initiate, append/finalize,
  relais, settle-listener, réconciliation) ; jobs (`PayoutRelayJob`, `ProcessPayoutItemJob`,
  `IngestPayoutFileJob`) ; enums + machines à états ; repos.
- **Produit `aiglebusiness/payout`** (présentation `client`) : routes/controllers/validators, auth
  (membre + `payout:initiate`/`approve`), maker-checker, résolution `org → account`, **parsing XLSX**
  (job d'ingestion produit) → appelle le **service core**.

### Simplification clé — `payout_item` EST l'outbox
Pas de **table outbox séparée** : la table **`payout_item`** (status `queued` + `next_retry_at`) **est**
le journal de travail durable. Le relais tire les items dus ; l'« outbox-in-transaction » (S3-P4)
signifie juste que **items + réservation committent ensemble** → le relais les trouve toujours. Un
composant de moins.

### Enums / extensions
- `TransactionType.PAYOUT` (décommenter).
- `PayoutBatchStatus` : `ingesting, pending_approval, queued, processing, completed, partial, failed,
  failed_ingestion, rejected, cancelled`.
- `PayoutItemStatus` : `queued, sending, sent, succeeded, failed, released, needs_review, cancelled`.
- Engine : `initiateExternalOut({ prefunded?: boolean })` (saute la jambe débit).
- Gouverneur : token bucket Redis (voies interactif/batch) devant l'adaptateur Hub2.
- Catalogue : service type **`payout`** + lignes SPM (tarifs business) — à vérifier/seeder.

### Migrations (lancées par l'utilisateur)
1. `payout_batches` (schéma S2).
2. `payout_items` (schéma S2, index `batch_id`, `status`, `next_retry_at`, unique `idempotency_key`).
3. (aucune table outbox — `payout_item` fait office).
4. `TransactionType.PAYOUT` = code seulement (pas de migration).

### Découpage tracer-bullets (slices verticales, TDD — money d'abord)
| # | Slice (comportement) | Test prioritaire |
|---|---|---|
| **B1** | Engine **`prefunded`** : `initiateExternalOut({prefunded})` **ne débite pas** (record+ledger+provider) | unit/func : pas de débit, transaction créée |
| **B2** | Modèles + migrations + **réservation** (débit gardé du total ; release = recrédit) | func : réserve atomique, insuffisant→reject, release recrédite |
| **B3** | **Initiation JSON** (petit lot) : valide + réserve + bulk-insert + `queued` + idempotence requête | func : lot+items, fonds tenus, rejeu = même lot |
| **B4** | **Exécution** : `PayoutRelayJob` (token bucket, SKIP LOCKED) + `ProcessPayoutItemJob` (prefunded, états, retry) | func : drain au débit, sent, retryable→retry, terminal→failed+release |
| **B5** | **Settlement** : webhook → settle → `PayoutItemSettledListener` (compteurs, agrégation, release) | func : succès→count, échec→release, lot completed/partial |
| **B6** | **Réconciliation** cron : items `sent` orphelins → poll `GET /:id/status` → settle | func : item bloqué résolu |
| **B7** | **Ingestion XLSX** async : upload → `IngestPayoutFileJob` (streaming, chunk, strict) → finalize | func : valide→queued, invalide→failed_ingestion, insuffisant→rejected |
| **B8** | **Maker-checker** : `pending_approval` → approve→queued / reject→rejected+release ; séparation | func : approve≠initiateur, self-approve owner |
| **B9** | **Présentation produit** `aiglebusiness/payout` : auth, permissions, gate **ENTREPRISE L2**, single interactif direct, mass upload | func HTTP : 202, 403 marchand/non-KYB, 403 non-autorisé |
| **B10** | **Frais** : service type `payout` catalogue + pré-calcul par item | func : frais figés, business débitée du total+frais |
| **D1** | Swagger `business.yaml` : endpoints payout (single, upload, batch status, approve) | doc même passe ([[always-update-api-doc]]) |

### Priorités de test (fintech — comportement, pas implémentation)
1. **Invariant de fonds** (B2/B5) : l'org **ne paie que les réussis** ; `hold == Σ succeeded + Σ released`.
2. **Idempotence** (B3/B4/B5) : rejeu requête/job/webhook → **jamais** double lot/paiement.
3. **Gate d'éligibilité** (B9) : marchand & non-KYB **bloqués**.
4. **Isolation d'échec** (B4) : un item échoué n'affecte aucun autre ; succès partiel correct.
5. Non-régression : les 4 échecs baseline restent le seul rouge attendu.

### Points à trancher pour clore S7
- **P1** — L'**ordre des slices** (money B1/B2 → orchestration B3-B6 → ingestion B7 → approbation B8 →
  présentation B9/B10) te convient ?
- **P2** — **`payout_item` = outbox** (pas de table séparée) — validé ?
- **P3** — Contexte core **`core/money/payout`** (nouveau) vs sous `money_movement` — confirmé ?
- **P4** — On démarre l'implémentation **après ton feu vert explicite** (brainstorm bouclé ≠
  autorisation de coder), en commençant par **B1** ?

## Fin du brainstorming  *(après S7)*
