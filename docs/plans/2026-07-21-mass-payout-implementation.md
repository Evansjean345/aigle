---
type: implementation-plan
statut: prêt
derniere_maj: 2026-07-21
lot: 2 — paiement en masse (mass-transfer) MVP
design: docs/plans/2026-07-11-payout-business-design.md (registre L2-D1→L2-D28)
reference: docs/systeme-paiement-masse.md
branche: feat/core-consolidation
---

# Plan d'implémentation — Paiement en masse (Lot 2, MVP)

Découpage TDD des slices **B1→B10** (B7 différé). Chaque slice : **test rouge d'abord**, puis
implémentation jusqu'au vert, sans régression. Ordre imposé par les dépendances (argent d'abord, puis
orchestration, puis présentation, puis frais).

## Préconditions & conventions

- **Migrations lancées par l'utilisateur** (jamais par l'agent) : après avoir écrit un fichier de
  migration, demander à l'utilisateur de lancer `node ace migration:run`.
- **Nommage `transfer_*`** partout (L2-D1) : `TransferBatch`/`TransferItem`, `core/money/transfer`,
  `aiglebusiness/transfer/mass`, permissions `transfer:initiate`/`transfer:approve`.
- **Commandes de test** (japa) :
  - unit : `node ace test --files="unit/..."`
  - business (func) : `node ace test --files="business/..."`
  - money (func) : `node ace test --files="money/..."`
- **Harness func argent** (réutiliser) : `tests/functional/payments-flow/mocks/operations_fixtures.ts`
  → `swapGuards()`, `swapProviderGateway()`, `reloadBalance()`, `QueueManager.fake()`,
  `db.beginGlobalTransaction()` / `rollbackGlobalTransaction()` + `SET FOREIGN_KEY_CHECKS`.
  Pattern `makeOrgWallet(balance)` (wallet org sans user) : voir
  `tests/functional/business/transfer_settlement_flow.spec.ts`.
- **Priorités de test fintech** (à couvrir en rouge d'abord, dans l'ordre) :
  1. **Invariant de fonds** : `hold == Σ succeeded + Σ released` ; l'org ne paie que les réussis.
  2. **Idempotence** : rejeu requête / job / webhook → jamais de double lot / double-paiement.
  3. **Isolation d'échec** : un item échoué n'affecte aucun autre ; succès partiel correct.
  4. **Gate** : marchand bloqué sur le mass (403).
  5. Non-régression : les baselines rouges connues restent les seules rouges.
- **Ne jamais** casser le chemin **consumer / transfert unique** : les extensions de `external_out` /
  `settle_transfert` / `LedgerService` sont **gardées par un flag** (`prefunded`) ou **additives**.

---

## Migrations (à écrire ; lancées par l'utilisateur)

| # | Migration | Contenu |
|---|---|---|
| M1 | `create_transfer_batches_table` | `id` (increments), `reference` (unique), `account_id` (index), `initiated_by`, `approved_by` (null), `label`, `description` (null), `total_amount`, `fees`, `currency`, `expected_count`, `successful_count` (default 0), `failed_count` (default 0), `status` (enum), `idempotency_key` (unique, null), `reservation_ref` (null), timestamps |
| M2 | `create_transfer_items_table` | `id` (increments), `batch_id` (fk index), `idempotency_key` (unique), `sequence`, `amount`, `fees`, `currency`, `recipient_name`, `recipient_phone`, `operator`, `country`, `status` (enum), `transaction_reference` (null), `provider_reference` (null), `failure_reason` (null), `attempts` (default 0), `next_retry_at` (null), `settled_at` (null), timestamps ; index `status`, `next_retry_at` |
| M3 | `alter_ledgers_transaction_id_nullable` | rendre `ledgers.transaction_id` nullable (déjà nullable côté DB d'après la migration d'origine — **vérifier**, sinon `ALTER`) |

**Enums (code, pas de migration)** :
- `TransferBatchStatus` : `pending_approval, queued, processing, completed, partial, failed, rejected, cancelled` (**omet** `ingesting`/`failed_ingestion` → B7).
- `TransferItemStatus` : `queued, sending, sent, succeeded, failed, released, needs_review, cancelled`.

---

## B1 — Engine : mode pré-financé (`prefunded`) — ✅ FAIT (2026-07-21)

> Livré : `ExternalOutCommand.prefunded?` ajouté ; `external_out.use_case.ts` saute débit + ledger de
> débit + events `WALLET_DEBITED`/`LEDGER_ENTRY_CREATED` en prefunded. Test
> `tests/functional/business/prefunded_external_out.spec.ts` (2 vert). Non-régression : settlement
> flow + initiate_transfer (4 vert).

**Objectif (L2-D3).** `initiateExternalOut({ prefunded: true })` **ne débite pas** le wallet et
**n'écrit pas** de ligne ledger de débit, mais crée la transaction PENDING + appelle le provider.

**Test rouge d'abord** — `tests/functional/business/prefunded_external_out.spec.ts` :
- `prefunded → wallet NON débité, transaction PENDING créée, provider appelé, 0 ligne ledger` :
  monte un `makeOrgWallet(100000)`, résout `ExternalOutUseCase`, `handle({..., prefunded:true})` ;
  asserte `reloadBalance == 100000`, `Transaction WHERE reference` = PENDING + `accountId == orgId`,
  `gateway.resolver.invokes.length == 1`, `Ledger WHERE transaction_id = tx.id` **vide**.
- Non-régression : `prefunded:false` (défaut) → wallet **débité** (garde-fou).

**Fichiers :**
- `app/core/money/money_movement/domain/types/money_movement_types.ts` : `ExternalOutCommand` → `+ prefunded?: boolean`.
- `app/core/money/money_movement/application/use_cases/initiation/external_out.use_case.ts` :
  - garder `walletService.debitBalance` (ligne ~70) et `ledgerService.recordTransfer` (ligne ~106)
    derrière `if (!cmd.prefunded)`.
  - en prefunded : `balanceBefore == balanceAfter == wallet.balance` ; **sauter** les events
    `WALLET_DEBITED` / `LEDGER_ENTRY_CREATED` (`emitLifecycle` conditionne ces deux emits).
  - `partyValidator.validate` + `feeResolver.resolve` : **inchangés** en B1 (la fee figée arrive en B10).

**Vérif :** le test consumer existant (débit normal) reste vert ; le nouveau prefunded vert.

---

## B2 — Réservation (hold option A) — ✅ FAIT (2026-07-22)

> **Ajustement TDD** : B2 resserré à la **mécanique de réservation seule** (testable sans nouvelle
> table). Les **modèles + migrations (M1/M2) + enums de statut + repos** sont **déplacés en B3**, où
> le test d'initiation les exerce (pas de code non couvert en avance). **M3 supprimé** :
> `ledgers.transaction_id` est déjà nullable ; `operation_type` est une string (pas d'enum DB).
>
> Livré : `LedgerOperationType.RESERVATION`/`RESERVATION_RELEASE` ; `Ledger.transactionId` → nullable ;
> `LedgerService.recordHold`/`recordHoldRelease` (écriture directe au repo, transaction-less) ;
> `TransferReservationService.hold`/`releaseHold` (`core/money/transfer/application/services`). Test
> `tests/functional/money/transfer_reservation.spec.ts` (3 vert). Signatures **primitives** (cohérent
> `WalletService`/`LedgerService`, pas de Command pour un service interne — règle DTO).
>
> ⚠️ **Note run tests** : le dev server tient 3333 → lancer avec `$env:PORT='3334'`.

**Objectif (L2-D2/D4/D5).** Tables + modèles + `TransferReservationService` : `hold(total)` (débit
gardé + ligne ledger **sans transaction**) et `release`/`releaseHold`.

**Test rouge d'abord** — `tests/functional/money/transfer_reservation.spec.ts` :
- `hold : débit gardé atomique + ledger hold sans transaction` : wallet 100000 ; `hold(60000)` →
  `reloadBalance == 40000`, une ligne `Ledger WHERE wallet_id AND operation_type='reservation' AND transaction_id IS NULL` avec `amount 60000`, `reservation_ref` renseignée sur le batch.
- `hold : solde insuffisant → InsufficientFunds, aucun débit` : wallet 1000 ; `hold(60000)` throw,
  `reloadBalance == 1000`, 0 ligne ledger.
- `releaseHold : recrédit du total + ledger reversal sans transaction` : après hold, `releaseHold` →
  `reloadBalance == 100000`, une ligne `Ledger CREDIT operation_type='reservation_release' transaction_id IS NULL`.

**Fichiers :**
- Migrations M1, M2, M3 (ci-dessus).
- `app/core/money/transfer/domain/models/transfer_batch.ts`, `transfer_item.ts` (Lucid).
- `app/core/money/transfer/domain/enums/transfer_batch_status.ts`, `transfer_item_status.ts`.
- `app/core/money/ledger/domain/models/ledger.ts` : `transactionId: number | null` + belongsTo optionnel.
- `app/core/money/ledger/application/services/ledger_service.ts` : `recordHold({...})` (DEBIT,
  `operationType:'reservation'`, `transactionId:null`, description en dur) + `recordHoldRelease({...})`
  (CREDIT, `operationType:'reservation_release'`, `transactionId:null`).
- `app/core/money/transfer/application/services/transfer_reservation_service.ts` : `hold`, `releaseHold`.
- Repositories `transfer_batch_repository` / `transfer_item_repository` + impl Lucid.

**Vérif :** invariant — après hold puis releaseHold, solde inchangé ; ledger = 2 lignes qui s'annulent.

---

## B3 — Initiation JSON (`.../mass-transfers`) — ✅ FAIT (2026-07-22)

> Livré : migrations M1 `transfer_batches` + M2 `transfer_items` (lancées) ; enums de statut ;
> modèles `TransferBatch`/`TransferItem` ; ports repos (`domain/interfaces`) + impls (`infrastructure`)
> + binding `repository_provider.ts` ; DTO core `InitiateMassTransferCommand`/`MassTransferResult`
> (`application/dtos`) ; service core `TransferBatchService.initiate` (idempotence → hold → bulk-insert
> → `pending_approval`) ; use case produit + DTO produit + controller + validator Vine (cap 50) +
> routes (`.../mass-transfers`, middlewares Lot 1) + branchement `start/routes.ts`.
> Test `tests/functional/money/mass_transfer_initiation.spec.ts` (3 vert) : lot+items+réserve,
> idempotence sans double-réserve, insuffisant→throw sans lot. App boote OK, non-régression 9 vert.
>
> **Reporté à B9** (présentation) : le **test HTTP** de bout en bout (202/403/422) + le **gate
> ENTERPRISE** (middleware `requireEnterpriseForMass` sur le groupe de routes). Le controller/routes
> sont en place mais **pas encore gatés** ni testés via HTTP.

**Objectif (L2-D6/D8, L2-D20).** `POST .../mass-transfers` (≤ 50) : idempotence requête → valide →
réserve (hold sur `Σ montant`, frais en B10) → bulk-insert batch (`pending_approval`) + N items
(`queued`) → 202. **Zéro réseau provider.**

**Test rouge d'abord** — `tests/functional/business/mass_transfer_initiation.spec.ts` :
- `initiation : lot + N items créés, fonds tenus, 202 pending_approval` : org enterprise, wallet
  suffisant, 3 recipients → batch `pending_approval`, 3 `transfer_item` `queued`, `reloadBalance`
  baissé de Σ montant, réponse `202 { status: pending_approval, expectedCount: 3 }`.
- `idempotence requête : rejeu même idempotency_key → même lot, pas de re-réserve` : 2 appels même clé
  → 1 seul batch, débit appliqué **une** fois.
- `cap : > 50 recipients → 422`.
- `solde insuffisant → batch rejected (ou 4xx), aucun item drainable`.

**Fichiers :**
- `app/core/money/transfer/application/services/transfer_service.ts` : `initiate(cmd)` (idempotence,
  hold via B2, `insertMany` items, statut `pending_approval`), dans **une** transaction DB.
- `app/core/money/transfer/application/dtos/transfer.dto.ts`.
- `app/products/aiglebusiness/transfer/mass/application/use_cases/initiate_mass_transfer.use_case.ts`
  (résout org→account, mappe recipients).
- `app/products/aiglebusiness/transfer/mass/presentation/client/controllers/mass_transfer_controller.ts`
- `.../validators/mass_transfer_validators.ts` (recipients[] ≤ 50).
- `.../routes/mass_transfer_routes.ts` : miroir Lot 1 (geoip→businessChannel→auth→requireApp→businessDevice→`orgPermission(transferInitiate)`), idempotence header `X-Idempotency-Key`.

**Vérif :** le relais (pas encore là) n'existe pas → les items restent `queued` sous batch
`pending_approval` (non drainables). Frais = 0 pour l'instant (L2-D7).

---

## B4 — Exécution (relais + job d'item) — ✅ FAIT (2026-07-22)

> **B4b — Relais + gouverneur : ✅ FAIT.** `TransferRateGovernor` (port) + `RedisTransferRateGovernor`
> (token bucket Lua atomique, voie batch, capacité/refill 7, connexion `limiter`) ; bindé dans
> `repository_provider`. `TransferItemRepository.selectDueItemIds(limit)` (lot queued/processing + item
> queued frais **ou** retry échu `next_retry_at<=now`, ordonné `sequence`, limité — via repo).
> `TransferRelayService.tick()` (tokens → sélection → dispatch `ProcessTransferItemJob`, retourne
> `{dispatched, throttled}`). `TransferRelayJob` (wrapper mince, auto-replanifié `.in('2s')` tant qu'il
> y a progrès/throttle). Test `mass_transfer_relay.spec.ts` (4 vert) : dépletion du seau, sélection des
> dus, `pending_approval` jamais tiré, budget borne le dispatch. **Toutes les persistances via repos**
> (règle services≠models). Sweep transfer + non-régression : **19 vert**.
> Refinement : `.forUpdate() SKIP LOCKED` non posé au MVP (le verrou `lockForSending` est la garantie
> définitive anti-double-envoi) — optimisation de contention différée.

> **B4a — Job d'item : ✅ FAIT (2026-07-22).** `TransferItemProcessor` (logique testable) + wrapper
> `ProcessTransferItemJob` (mince, résout le service). Verrou idempotent `queued→sending` (UPDATE
> gardé), `engine.initiateExternalOut({prefunded})`, tri **retryable/définitif via `error.retryable`** :
> succès→`sent` ; retryable(<MAX)→`queued`+`next_retry_at` (base 30s, backoff, MAX 6) **sans** release ;
> définitif/MAX→`failed`+**release** de la part (`reservation.releaseHold`). **Raffinement engine
> (L2-D3/B4)** : en prefunded, `external_out` **omet `walletId`** au runner → **pas d'auto-reversal**
> (sinon un retryable libèrerait la part avant retry → rupture d'invariant) ; le release est piloté par
> le processor. Test `mass_transfer_execution.spec.ts` (3 vert). Non-régression 13 vert.
>
> **B4b — Relais + gouverneur : À FAIRE.** `TransferRateGovernor` (token bucket Redis, voie batch),
> `TransferRelayService` (sélection des items dus `FOR UPDATE SKIP LOCKED`, LIMIT=min(tokens,batch)),
> `TransferRelayJob` (tick auto-replanifié → dispatch `ProcessTransferItemJob`).

**Objectif (L2-D9/D10/D11/D12).** `TransferRelayJob` (auto-replanifié, token bucket **batch-only**,
`FOR UPDATE SKIP LOCKED`) + `ProcessTransferItemJob` (prefunded, états, retry via item).

**Test rouge d'abord** — `tests/functional/money/transfer_execution.spec.ts` (driver queue `sync` en
test) :
- `drain : items queued → sent, provider appelé une fois par item` : batch `queued` avec 3 items →
  après relais + jobs, 3 items `sent`, `provider_reference` renseignée, 3 invokes gateway.
- `verrou : un item déjà sending/terminal → SKIP (pas de double envoi)`.
- `retryable (429) → item reste dû (attempts++, next_retry_at), pas d'envoi définitif`.
- `définitif → item failed + release (wallet recrédité de la part)`.
- **Token bucket** : `min(tokens, batch_size)` respecté (test du gouverneur en isolation :
  `tests/unit/money/transfer_rate_governor.spec.ts` → n tokens/s, refill).

**Fichiers :**
- `app/core/money/transfer/application/services/transfer_rate_governor.ts` (token bucket Redis, voie
  batch ; en test, backend fake/déterministe).
- `app/core/money/transfer/application/services/transfer_relay_service.ts` (sélection due, SKIP LOCKED).
- `app/core/money/transfer/application/jobs/transfer_relay_job.ts` (`extends Job`, auto-`dispatch` avec
  délai tant qu'il reste des dus).
- `app/core/money/transfer/application/jobs/process_transfer_item_job.ts` (`extends Job` ; verrou
  `queued→sending` ; `engine.initiateExternalOut({prefunded:true})` ; mapping erreur retryable/définitif
  via classification Hub2 existante `hub2_error_map` ; retry via `next_retry_at`).

**Vérif :** isolation — un item `failed` n'empêche pas les autres de partir. Release réutilise le
refund existant (via settle en B5 pour l'échec webhook ; l'échec **définitif à l'envoi** appelle le
release directement).

---

## B5 — Settlement & agrégation — ✅ FAIT (2026-07-22)

> Livré : **D13** `settle_transfert.applyFailure` dispatche `TransfertTransactionFailed` (dispatché
> **avant** le refund pour toujours partir). **D14** `TransferSettlementService.applyItemSettlement`
> (item réglé **gardé** `markSettled WHERE status='sent'` → anti double-comptage ; compteurs batch
> **atomiques** `incrementSettlementCounter` FOR UPDATE ; agrégation `completed/partial/failed`) +
> `TransferItemSettledListener` (abonné aux events génériques, rattache par `transaction_reference`,
> ignore les tx hors mass). Le core `settle` reste générique. Repos étendus (`findByTransactionReference`,
> `markSettled`, `update`, `incrementSettlementCounter`). **D15** `OnTransfertSuccessNotification`
> guard `userId==null` (pas de push consumer par item/décaissement org). `start/events.ts` enregistre
> le listener sur Completed+Failed. Release au webhook-échec = refund existant (`settle`, inchangé).
> Test `mass_transfer_settlement.spec.ts` (5 vert). Sweep + non-régression : **24 vert**.
>
> Note : le test cible le **service** (déterministe). La chaîne webhook→`settle`→event→listener passe
> par `DispatchFlowEventJob` (async) — non exercée en test avec `QueueManager.fake()` ; le câblage
> events.ts + le service couvrent la logique.

**Objectif (L2-D13/D14/D15).** Webhook → `engine.settle` (déjà là pour l'argent) → ajouter l'event
d'**échec** → `TransferItemSettledListener` (item + compteurs + agrégation). Couper la notif consumer
par item.

**Test rouge d'abord** — `tests/functional/business/mass_transfer_settlement.spec.ts` :
- `succès partiel : 2 ok + 1 ko → batch partial, compteurs corrects, org débitée des 2 réussis` :
  monte un batch drainé (items `sent`), envoie webhooks succeeded×2 + failed×1 ; asserte items
  `succeeded`/`failed`, `successful_count=2`/`failed_count=1`, batch `partial`, wallet = hold − release
  du ko (invariant de fonds).
- `tous succès → completed` ; `tous échecs → failed`.
- `idempotence webhook : rejeu → pas de double compteur, pas de double crédit`.
- `notif consumer NON émise pour un item` (userId null → skip).

**Fichiers :**
- `app/core/money/money_movement/application/use_cases/settlement/settle_transfert.use_case.ts` :
  `applyFailure` → `dispatchFlowEvent('TransfertTransactionFailed', {reference, accountId, ...})` (L2-D13).
- `app/core/money/transfer/application/listeners/transfer_item_settled_listener.ts` : abonné à
  `TransfertTransactionCompleted` **et** `TransfertTransactionFailed` ; lookup `transfer_item WHERE
  transaction_reference` (pas trouvé → return) ; maj item + batch `FOR UPDATE` + agrégation.
- `start/events.ts` : enregistrer le listener sur les deux events.
- `app/core/notifications/application/listeners/on_transfert_success_notification.ts` : `if (!event.data.userId) return`.

**Vérif :** le release (échec) = refund existant sur la tx de l'item ; invariant de fonds vérifié
numériquement dans le test.

---

## B6 — Réconciliation générique (money-core) — ✅ FAIT (2026-07-28)

> **Précision majeure — L2-D29** : la réf provider + l'agrégateur vivent sur **`payments`**, pas sur
> `transactions` (une tx a **plusieurs** paiements : l'inter-réseau = 2 jambes = 2 réfs distinctes,
> la 2ᵉ écraserait la 1ʳᵉ). **M4** (lancée) ajoute `payments.provider_reference` + `payments.aggregator`
> (nullables, indexées). L'`aggregator` (= `providerName` : `hub2`, `wave`) rend le poll **routable** —
> besoin déjà réel, 2 adapters coexistent.
>
> Livré : type `ProviderPollResult` (`succeeded|failed|pending|unknown` — `pending` ne doit **jamais**
> être confondu avec un échec) ; `PaymentProviderPort.pollStatus?` (**optionnel** : un provider sans
> endpoint de statut n'est simplement pas réconciliable) ; Hub2 `GET /transfers/:id` + mapping aligné
> sur le vocabulaire des webhooks ; persistance de la trace provider dans **`ExternalInitiationRunner`**
> (point de passage **unique** des 4 initiations, best-effort — ne fait jamais échouer une initiation
> déjà acceptée) ; `resolveSettlementKind` **extrait** en source unique (webhook **et** réconciliation
> le partagent : deux mappings monétaires divergents = classe de bug inacceptable) ;
> `PaymentRepository.findStaleForReconciliation` (join tx PENDING + réf présente + `updated_at < now−20min`) ;
> `ReconcilePendingExternalUseCase` (poll → `engine.settle` idempotent ; isolation des échecs ;
> `unknown`/`pending` → **aucun** règlement deviné ; alerte revue manuelle au-delà de 24 h) ;
> `ReconcilePendingExternalJob` + `start/scheduler.ts` (`every 5m`).
> Tests `reconcile_pending_external.spec.ts` (5 vert). Suite : **279 vert** (seul rouge = baseline
> `DeviceService`, hors périmètre).
>
> ⚠️ **Écart assumé à L2-D17** : job **planifié** (scheduler) et non auto-replanifié. Une chaîne
> auto-replanifiée qui meurt (redémarrage/deploy/crash) ne repart jamais → la surveillance s'éteindrait
> **en silence**, pire défaut possible pour un filet de sécurité.
>
> **Reste** (hors MVP B6) : `TransactionStatus` n'a **pas** de `needs_review` (seul `TransferItemStatus`
> en a) → l'irrésolu au-delà du seuil dur est **journalisé en alerte** plutôt que persisté dans un état
> dédié. Ajouter ce statut toucherait tous les `switch` sur statut de transaction — à trancher à part.

**Objectif (L2-D16/D17/D18).** Cron générique : toute transaction externe PENDING orpheline → poll
provider → `settle`. Op provider **poll statut** (n'existe pas → à ajouter).

**Test rouge d'abord** — `tests/functional/money/reconcile_pending_external.spec.ts` :
- `tx externe PENDING orpheline (updated_at ancien) → poll terminal → settle → résolue` : crée une tx
  transfert PENDING avec `provider_reference` et `updated_at` > T ; fake poll renvoie succeeded ; après
  le job → tx `success` (et, si c'est un item, item `succeeded` via B5).
- `poll toujours pending → laisse` ; `très ancien / ambigu → needs_review`.

**Fichiers :**
- `app/core/money/provider_gateway/domain/types/provider_capabilities.ts` : `ProviderOperation` →
  `+ 'transfer-status'` (ou capacité de poll générique).
- `app/core/money/provider_gateway/infrastructure/adapters/hub2/hub2_adapter.ts` : `GET /transfers/:id/status`.
- Port money-movement gateway : `pollStatus(operation, providerRef)`.
- `app/core/money/money_movement/application/use_cases/settlement/reconcile_pending_external.use_case.ts`
  + `reconcile_pending_external_job.ts` (auto-replanifié ~5-10 min, T≈20 min).

**Vérif :** couvre consumer + single + items mass (générique) ; passe par le `settle` idempotent.

---

## ~~B7 — Ingestion XLSX~~ (DIFFÉRÉ, L2-D19)

Hors MVP. Sera : endpoint `.../mass-transfers/upload`, `IngestTransferFileJob` streaming (`exceljs`),
`appendItems`/`finalize`, états `ingesting`/`failed_ingestion`, all-or-nothing. **Ne pas implémenter.**

---

## B8 — Maker-checker (approve / reject) — ✅ FAIT (2026-07-22)

> Core : `TransferApprovalService.approve/reject` — lot chargé **`FOR UPDATE`** (`findByReferenceForUpdate`),
> garde d'état (`pending_approval` sinon **409**), séparation des tâches (approbateur ≠ initiateur sauf
> OWNER → **403**), transition. **approve** → `queued` + **kick relais** (`TransferRelayJob.dispatch`).
> **reject** → `rejected` + **`releaseHold`** (recrédit du hold complet, L2-D22). Exceptions métier
> (404/409/403) en `domain/exceptions`. Produit : `MembershipService.isOwner(org,user)` (rôle OWNER) ;
> `Approve/RejectMassTransferUseCase` (résolvent isOwner → délèguent au core) ; controller `approve`/
> `reject` ; routes `POST .../mass-transfers/:reference/approve|reject` en **groupe séparé**
> (`orgPermission(transferApprove)`). Test `mass_transfer_approval.spec.ts` (5 vert) : approve→queued+kick,
> self-approve non-owner→403, owner→ok, reject→rejected+release, garde d'état→409. Sweep : **29 vert**.

**Objectif (L2-D20/D21/D22).** `pending_approval` → approve (`queued` + kick relais) / reject
(`rejected` + `releaseHold`). Séparation des tâches + self-approve owner.

**Test rouge d'abord** — `tests/functional/business/mass_transfer_approval.spec.ts` :
- `approve par un membre ≠ initiateur → queued + relais kické` : batch `pending_approval` ; approbateur
  distinct avec `transfer:approve` → batch `queued`, `approved_by` renseigné, `TransferRelayJob` dispatché.
- `approve par l'initiateur (non-owner) → 403` ; `approve par l'owner (== initiateur) → OK`.
- `reject → rejected + releaseHold (wallet recrédité du total)`.
- `garde d'état : re-approve d'un batch déjà queued → 409` ; `approve concurrent → un seul passe (FOR UPDATE)`.

**Fichiers :**
- `app/core/money/transfer/application/services/transfer_service.ts` : `approve(batchId, approver)` /
  `reject(batchId, approver, reason)` (`FOR UPDATE` + garde d'état + séparation + owner ; reject →
  `releaseHold`).
- `app/products/aiglebusiness/transfer/mass/application/use_cases/approve_mass_transfer.use_case.ts` /
  `reject_mass_transfer.use_case.ts` (résout le rôle owner, dispatch relais sur approve).
- Routes `POST .../mass-transfers/:id/approve` et `/reject` (+ `orgPermission(transferApprove)`).
- **B3 déjà** : le batch naît `pending_approval` (L2-D20).

**Vérif :** l'approbateur sait que les fonds sont tenus (hold posé en B3) ; reject libère tout.

---

## B9 — Présentation (gate enterprise + lecture) — ✅ FAIT (2026-07-22)

> **Gate (D23)** : `MassTransferEnterpriseOnlyException` (403) + policy `assertOrganisationCanMassTransfer`
> (org ≠ ENTERPRISE → 403) + middleware `requireEnterpriseForMass` (nommé dans `start/kernel.ts`),
> appliqué **sur les 3 groupes** de routes après `orgPermission`. **Lecture (D24/D26)** :
> `TransferQueryService.listBatches(accountId, status?)` + `getBatchDetail(accountId, reference)`
> (**isolation par org** : détail null si le lot n'appartient pas au compte) → **DTO plats**
> (`MassTransferBatchSummary`/`BatchDetail`/`ItemView`). Repos : `findByReference`, `listByAccount`,
> `listByBatch`. Produit : `List`/`GetMassTransferUseCase` (get → 404 si absent), controller `index`/
> `show`, routes `GET .../mass-transfers` + `/:reference` (groupe `transactions:view`). Tests
> `mass_transfer_query.spec.ts` (5 vert : gate ×3, liste filtrable, détail+isolation). Sweep : **34 vert**.
>
> Rappel : **pas de `PayoutNotEligibleException`** (L1-D6) ; le gate est **segment** (enterprise), les
> montants = les limites (au drain). Le transfert unique Lot 1 reste ouvert au marchand (routes non
> touchées). Notifications d'approbation **différées** (D25).

**Objectif (L2-D23/D24/D26).** Gate `.../mass-transfers` = ENTERPRISE-only ; endpoints de lecture
(liste + détail) via `transactions:view` ; DTO minimal.

**Test rouge d'abord** — `tests/functional/business/mass_transfer_presentation.spec.ts` :
- `marchand → 403 E_MASS_TRANSFER_ENTERPRISE_ONLY` sur `POST .../mass-transfers` (et sur la lecture).
- `enterprise → passe le gate`.
- `GET .../mass-transfers?status=pending_approval` → liste filtrée (DTO minimal, pas de modèle brut).
- `GET .../mass-transfers/:id` → batch + items + compteurs.

**Fichiers :**
- `app/products/aiglebusiness/transfer/mass/presentation/client/middleware/require_enterprise_for_mass_middleware.ts`
  (réutilise `OrganisationAccountType`/le check de type d'org ; erreur `E_MASS_TRANSFER_ENTERPRISE_ONLY`),
  posé sur le **groupe** de routes (après `orgPermission`).
- Use cases `list_mass_transfers` / `get_mass_transfer` (gardés `transactions:view`).
- DTO de sortie minimal (batch + items).

**Vérif :** aucun `PayoutNotEligibleException` (L1-D6) ; le gate est **segment**, pas KYB. Le transfert
unique (Lot 1) reste **ouvert au marchand** — ne pas toucher ses routes.

---

## B10 — Frais

**Objectif (L2-D27/D28).** Frais pré-calculés par item (grille `transfert`), figés ; la fee figée est
passée au prefunded (pas de recalcul).

**Test rouge d'abord** — `tests/functional/business/mass_transfer_fees.spec.ts` :
- `initiation : hold = Σ(montant + frais), frais figés sur chaque item` : recipients avec montants →
  batch `total_amount`/`fees` = somme calculée (grille transfert), items portent `fees` figés,
  `reloadBalance` baissé de `Σ(montant+frais)`.
- `drain : la transaction de l'item porte la fee FIGÉE (pas recalculée)` : même si la grille change
  entre initiation et drain, la tx utilise la fee de l'item.
- `business débitée du total + frais` (invariant avec frais).

**Fichiers :**
- `app/core/money/transfer/application/services/transfer_service.ts` : `initiate` calcule les frais par
  item via `FeeResolver` (`serviceTypeCode = TRANSFERT`), fige `amount`/`fees` sur l'item, hold =
  `Σ(amount+fees)` (complète L2-D7).
- `app/core/money/money_movement/domain/types/money_movement_types.ts` : `ExternalOutCommand` → `+ fees?: number`.
- `external_out.use_case.ts` : en **prefunded**, si `cmd.fees` fourni → **sauter `FeeResolver`** et
  utiliser la fee figée pour la transaction.
- `process_transfer_item_job.ts` : passe `fees: item.fees` dans la commande.

**Vérif :** invariant de fonds recalculé **avec** frais ; pas de dérive de fee entre initiation et drain.

---

## Doc & Swagger (dans la même passe)

- ✅ **FAIT (2026-07-22)** : `docs/swagger/business.yaml` documente `POST .../mass-transfers`,
  `GET .../mass-transfers` (+`?status`), `GET .../mass-transfers/:reference`, `POST …/:reference/approve`,
  `POST …/:reference/reject` (tag « Business - Paiement en masse ») + schémas `MassTransferRequest`,
  `MassTransferResponse`, `MassTransferBatchSummary`, `MassTransferItemView`, `MassTransferBatchDetail`
  + param `MassTransferReference`. Codes 202/200/400/403/404/409/422. YAML validé (parse OK).
- Reste : répercuter dans `docs/systeme-paiement-masse.md` si le contrat bouge (frais B10).
- Rappel DB : les slugs `organisation_role_permissions` encore `payout:*` → **MAJ manuelle** vers
  `transfer:*` (l'OWNER bypasse entre-temps).

## Ordre & dépendances

```
B1 (engine prefunded) ─┐
B2 (modèles + hold) ───┼─▶ B3 (initiation) ─▶ B4 (exécution) ─▶ B5 (settlement) ─▶ B6 (réconciliation)
                       │                                   └─▶ B8 (maker-checker) ─▶ B9 (présentation)
                       └────────────────────────────────────────────────────────────▶ B10 (frais)
```

B1 et B2 sont indépendants et peuvent être menés en parallèle. B10 se greffe sur B3 (calcul) + B4
(passage de la fee figée) une fois le pipeline vert.

## Rappels fintech (à chaque slice)

- **Ne jamais** re-débiter en prefunded ; **ne jamais** écrire de ligne ledger de débit par item.
- **Toujours** vérifier l'invariant `hold == Σ succeeded + Σ released` dans les tests de settlement.
- **Toujours** rendre les handlers (job/webhook/approve) idempotents (garde d'état / lookup terminal).
- **Ne pas** régresser le chemin consumer / transfert unique (extensions gardées par `prefunded`/additives).