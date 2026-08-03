# Prompt de démarrage — Réapprovisionnement (suite)

> Copier-coller le bloc ci-dessous au démarrage de la nouvelle session.

---

Nous continuons la feature **demande de réapprovisionnement** (organisation → crédit du wallet).

**Lis d'abord** `docs/plans/2026-07-28-demande-reapprovisionnement-design.md` : il contient le
contexte exploré, les décisions **R-D1 → R-D6**, le découpage **F1 → F5** et les inconnues I1-I3.
Ne re-pose aucune question dont la réponse y figure.

## État

Le lot **F1 (catalogue des comptes de collecte)** est **livré et commité** côté API (`9950c3c`) :
migration, modèle, repository, service, 3 exceptions typées, contrôleurs admin + client, routes,
5 tests verts, OpenAPI.

Rappel du flux décidé : le marchand verse **hors plateforme** sur un compte Aigle (numéro Wave,
RIB) qu'il consulte dans le catalogue, puis **déclare** son versement avec un justificatif ; un
gestionnaire vérifie le versement réel et **crédite le wallet du montant vérifié**, avec double
validation au-delà d'un seuil.

## À faire, dans cet ordre

1. **Espace admin (front)** — page du catalogue des comptes de collecte dans
   `apps/aiglesend/admin`, layer **`catalog`** (il porte déjà `pages/pricings` et
   `pages/providers` : suivre ce patron — `pages/`, `composables/`, `services/`, entrée dans
   `permissions.ts`). L'API admin existe : `GET/POST /api/admin/collection-accounts`,
   `PATCH /:reference`, `PATCH /:reference/toggle`.
   ⚠️ **Pas de bouton Supprimer** : on désactive (`toggle`). ⚠️ **L'identifiant bancaire n'est pas
   éditable** après création — le formulaire d'édition ne doit pas le proposer.
2. **F2 — déclaration marchand** : `funding_request` (montant déclaré, canal, preuve,
   **référence unique** à reporter dans le motif du versement), création + liste + détail,
   permission `provision:request`. Toujours **zéro argent**.
3. **F3 — validation & crédit** ⚠️ *money-critique*, en TDD strict : `WalletAdjustmentService.adjust()`
   en CREDIT (primitive **existante**, inconnue I1 levée), montant **vérifié** distinct du montant
   **déclaré**, identité du valideur journalisée, écart visible.

## Contraintes du projet à respecter

- **Brainstorming obligatoire** avant tout nouveau lot (F2, F3…) — même court. Consigner les
  décisions dans le registre du document de design **au fil de l'eau**.
- **Migrations lancées par l'utilisateur**, jamais par l'agent : écrire le fichier puis demander
  `node ace migration:run`.
- **Contrats DTO** (`.junie/skills/adonis-ddd-code-review/Checklist.md`) : commands dans
  `application/dtos/`, DTO de sortie distinct, **aucun modèle Lucid renvoyé en HTTP**, `DateTime`
  sérialisé en string.
- **Exceptions typées** dans `domain/exceptions/` (`static status` / `static code`), jamais
  `Exception` inline.
- **Toute persistance via repository** — pas d'accès modèle depuis un service.
- **OpenAPI** : routes admin dans un yaml chargé par `adminOptions` (ex. `catalogs.yaml`) **et**
  taguées `Admin - …` (le tri se fait par préfixe de tag) ; routes business dans `business.yaml`.
- Tests : `PORT=3334 node ace test functional`. **Baseline : 295/296** — le seul rouge attendu est
  `DeviceService | appareil rooté`, préexistant et hors périmètre. TS : **74 erreurs** de baseline.
- **Ne jamais commiter `backups.rar`**.

## Points ouverts hors code

- **I2** — ce que les banques ivoiriennes exposent (notifications, relevés API, comptes virtuels) :
  détermine la trajectoire d'automatisation du rapprochement.
- **I3** — séparation des tâches : le valideur ne devrait pouvoir ni modifier le catalogue ni
  ajuster un wallet directement. À trancher avant la production.

## Dette d'autres chantiers (ne pas oublier)

- **Repo mobile non commité** : checkout deep-link (B1→B4) + `docs/conventions-navigation.md`. Le
  correctif du gel n'a pas été revalidé sur appareil depuis le retrait des logs de debug.
- **Worker de queue à redémarrer** : c'est un processus séparé du serveur HTTP ; sans redémarrage,
  les releases d'items de paiement en masse tournent encore sur l'ancien code (frais non ventilés).
- **Statuts Hub2** à confirmer par un appel sandbox (`GET /transfers/:id/status`) : les valeurs non
  reconnues tombent en `unknown` — sans danger, mais non réconciliées.
