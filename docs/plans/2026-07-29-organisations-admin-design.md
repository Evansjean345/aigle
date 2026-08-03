---
status: draft
etape: 1
lot: -
derniere_maj: 2026-07-29
---

# Organisations — espace admin (design)

## Contexte

Le back-office admin doit gérer les organisations business (marchands / entreprises) créées via le
produit `aiglebusiness/organisation`. État des lieux :

- **Front admin** (`apps/aiglesend/admin/app/layers/organisation/`) : **déjà construit mais 100 %
  mocké** (`mocks/organisations.mock.ts`). Le service `organisations.service.ts` fige sa surface
  (noms, arguments, types de retour) sur la future API et documente chaque endpoint cible en
  commentaire. Composants, composables et pages sont en place : liste + stats + recherche,
  page détail à 6 onglets (info, members, wallet, transactions, mass-payout, kyb), actions
  bloquer/activer.
- **API** : seul un layer **client (marchand)** existe (`organisation/presentation/client/`).
  **Aucun endpoint admin organisation** n'existe. Le domaine est solide : modèle `Organisation`,
  enums (`accountType = marchand|enterprise`, `level = level_0|1|2`, `status = active|inactive`),
  repository, `OrganisationResponseDTO`. Sous-domaines voisins existent partiellement :
  `membership` (membres/rôles), `core/money/wallet`, `transactions`, `transfer/mass`.
- **KYB** : explicitement non implémenté (`OrganisationKybStatus` est un placeholder front).
  **Mass-payout** : les types front sont « alignés sur le futur backend » — non implémenté côté
  admin non plus.
- **Permissions** : le front déclare déjà `organisations.read`, `organisation.read`,
  `organisation.block`, `organisation_members.read`, `organisation_wallet.read`,
  `organisation_transactions.read`, `organisation_kyb.read`. Aucun seeder ne les crée côté API.
- **Routing** : `start/admin_routes.ts` ne monte aucune route organisation. La sidebar admin a
  déjà l'entrée `/organisations`.

Contraintes héritées : DDD par couches, DTO contrats, exceptions typées, persistance via
repository, OpenAPI admin taguée « Admin » dans un yaml chargé par `adminOptions`, migrations
lancées par l'utilisateur, baseline TS 74 erreurs, ne jamais commiter `backups.rar`.

Inconnues à trancher : périmètre du premier lot (certains onglets n'ont pas de backend), granularité
des permissions, exposition du propriétaire (résolu depuis le core par `ownerUserId`).

## Décisions

| # | Décision | Alternatives écartées | Raison | Date |
|---|----------|----------------------|--------|------|
| O-D1 | Périmètre itération 1 = **base + actions** : liste/stats/recherche, détail (info propriétaire + wallet + membres), bloquer/activer, + endpoint admin transactions org-scoped. | Surface complète mockée (inclut KYB + mass-payout sans backend) ; lecture seule minimale | KYB et mass-payout n'ont pas de backend — les construire sortirait du périmètre. La lecture seule ne couvre pas le besoin de modération (bloquer). | 2026-07-29 |