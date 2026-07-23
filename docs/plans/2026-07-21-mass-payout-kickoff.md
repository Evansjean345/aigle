# Nouvelle session — Implémenter le PAIEMENT EN MASSE (mass-payout, Lot 2)

> Prompt de démarrage à copier-coller dans une nouvelle session.

## Objectif
Implémenter le **paiement en masse** business (1 → N bénéficiaires) dans le backend
`H:/Fintech-Aigle/organization/apps/aiglesend/api` (AdonisJS v6), branche `feat/core-consolidation`.

## Source de vérité — À LIRE EN ENTIER D'ABORD
`docs/plans/2026-07-11-payout-business-design.md` — design complet validé, sessions S1→S7 :
- S1 archi d'exécution (initiation rapide + réservation de fonds + relais outbox + settlement/réconciliation)
- S2 modèle de données (batch + items, machines à états)
- S3/S3b initiation + ingestion fichier XLSX (streaming, strict all-or-nothing)
- S4 exécution async (relais planifié, gouverneur d'égress token-bucket devant Hub2, retries/backoff)
- S5 settlement & réconciliation (webhook-first, succès partiel)
- S6 maker-checker + frais + gate KYB
- S7 intégration + découpage tracer-bullets B1→B10

## État actuel — LE LOT 1 EST DÉJÀ FAIT (ne pas le refaire)
Le **transfert unique** (Lot 1) est implémenté, testé et commité : module
`app/products/aiglebusiness/transfer/`, endpoint `POST /api/business/organisations/:id/transfers`.
Il réutilise `engine.initiateExternalOut` + le settlement transfert existant.

## ⚠️ DÉCISIONS POSTÉRIEURES AU DESIGN DOC (elles PRIMENT sur le doc)
- **L1-D7 — Taxonomie unifiée** : tout mouvement vers un compte **externe** = `TransactionType.TRANSFERT`
  (PAS de type `payout`). Le mass-payout doit produire des transactions **TRANSFERT**.
  Ne PAS confondre avec l'opération PROVIDER `'payout'` (gateway cash-out Hub2/Wave) qui, elle, reste.
- **L1-D8 — Rename code `payout` → `transfer`** : Lot 1 = module `aiglebusiness/transfer/`,
  permission `transfer:initiate` / `transfer:approve`.
  → **À TRANCHER AVEC L'UTILISATEUR EN DÉBUT DE SESSION** : le Lot 2 suit-il ce nommage
  (`transfer_batch`/`transfer_item`, « transfert de masse ») ou garde `payout_batch`/`payout_item` ?
  Le design doc dit encore `payout_*`. Trancher AVANT de créer les migrations.

## Acquis techniques du Lot 1 réutilisables par le Lot 2
- `engine.initiateExternalOut(cmd)` : débit gardé → tx PENDING → gateway → `MovementResult`.
  Settlement par webhook `transfer.*` → `settle_transfert` (succès → SUCCESS, échec → REFUNDED + refund).
- `external_out` rattache la tx au **compte source** (`accountId`) + rollback correct (fix fuite de verrou).
- Volume **account-centric** : `TransfertTransactionCompleted` porte `accountId`.
- Le **mode pré-financé** `initiateExternalOut({ prefunded })` (S4/D-exec-2) N'EXISTE PAS encore → c'est le **B1**.
- Le **gouverneur d'égress** (token bucket Redis devant Hub2, S4/D7) N'EXISTE PAS encore.
- Permission `transfer:approve` déjà cataloguée pour le maker-checker. ⚠️ Slugs en DB
  (`organisation_role_permissions`) encore `payout:*` — MAJ manuelle en attente.
- Cache limites KYB = bentocache (Redis db 2, TTL 24h, L1 mémoire + L2) — un re-seed n'invalide pas
  le cache ⇒ redémarrer l'app après changement de grille `kyc_level`.

## Méthode
1. Charger le skill `brainstorming` pour **reprendre** le design Lot 2 (déjà conçu S1–S6) : re-valider
   face au code actuel + trancher le nommage (L1-D8). Ne pas re-poser ce qui est déjà au registre.
2. Implémenter en **TDD** (test rouge → vert) slice par slice, ordre des tracer-bullets S7 :
   B1 engine prefunded → B2 modèles + réservation → B3 initiation JSON → B4 exécution (relais + item job)
   → B5 settlement/agrégation → B6 réconciliation cron → B7 ingestion XLSX → B8 maker-checker
   → B9 présentation HTTP → B10 frais → doc swagger.
3. Priorités de test fintech : invariant de fonds (l'org ne paie que les réussis), idempotence
   (requête/job/webhook), isolation d'échec (succès partiel), gate d'éligibilité.
4. Migrations lancées par l'utilisateur ; toujours mettre à jour `docs/swagger/business.yaml` dans la même passe.

## Repo / env
`aiglesend/api` (AdonisJS v6) · branche `feat/core-consolidation` · MariaDB docker `aiglesend-dev-mariadb`
· Redis `aiglesend-dev-redis` (db 4 volumes, db 2 cache bentocache) · tests japa
(`node ace test --files="unit/..."` / `"business/..."`).