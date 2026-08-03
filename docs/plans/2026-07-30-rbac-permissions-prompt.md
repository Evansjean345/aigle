# Prompt de reprise — Règles de définition des permissions (RBAC back-office)

> À coller tel quel au démarrage d'une nouvelle session.

---

Nous allons définir les **règles de définition, de configuration et de mise en place des
permissions** du back-office, puis les appliquer.

**Commence par un brainstorming** — invoque le skill `brainstorming` et suis son processus depuis
l'étape 0. Ne code rien avant que le design soit approuvé. À l'issue du design, **rédige un nouvel
ADR** avec le skill `addr-author` : la décision touche le contrôle d'accès de toute la plateforme,
elle doit être défendable dans deux ans.

Lis d'abord `docs/plans/remarques-a-brainstormer.md`, remarque **R1** (🔴 Critique, « Permissions du
RBAC team créées en CRUD par l'admin au lieu d'être déclarées en code »). Ce chantier est la réponse
à R1 : le design devra la clore ou la requalifier explicitement.

---

## Ce que la revue de code a déjà établi

Inutile de refaire ces relevés — mais **vérifie qu'ils tiennent toujours** avant de t'appuyer
dessus, le code a pu bouger.

### Quatre mécanismes coexistent pour déclarer une permission

| Mécanisme | Où | Exemple |
|---|---|---|
| Catalogue en code, par feature | `*/presentation/admin/permissions.config.ts` | `ledger`, `transactions`, `wallet`, `audit` |
| Catalogue en code, métier | `aiglebusiness/membership/domain/permissions.config.ts` | 11 permissions d'organisation, avec un drapeau `sensitive` |
| Slug écrit dans un seeder, sans catalogue | `database/seeders/*_permission_seeder.ts` | `funding_requests.*`, `mass_transfers.read`, `organisations.*`, `collection_accounts.*` |
| CRUD à l'exécution par l'admin | `core/team/application/use_cases/permissions/` | c'est l'objet de R1 |

Le front en ajoute un cinquième, en miroir : une énumération TypeScript par layer
(`app/layers/*/permissions.ts`), qui redéclare les slugs sans lien vérifiable avec le serveur.

### La dérive est déjà mesurable

**Onze permissions sont exigées par le code et semées nulle part.** Le contrôle ne peut donc pas
passer :

```
ledger.read              transaction.read              user_ledgers.read
ledgers.read             transaction_ledger.read       user_ledgers_report.read
ledgers_report.read      transactions.read             user_transactions.read
                         transactions_report.read      user_transactions_report.read
```

**Quatre permissions sont semées et vérifiées nulle part** — des permissions fantômes, qui donnent
un faux sentiment de contrôle : `finance.view`, `kyc.manage`, `support.access`, `users.manage`.

### Le rôle tout-puissant n'a pas le même nom des deux côtés

Le code contourne les contrôles pour le slug **`root`** — dans `permission_helpers.ts`,
`permission_middleware.ts` et `admin_otp_attempt_guard.ts`. Or `role_permission_seeder.ts` crée
`super_admin`, `admin`, `kyc_agent`, `finance_admin`, `support_agent` — **pas `root`**. Et tous les
seeders de feature rattachent leurs permissions à `super_admin`.

Conséquence à confirmer en base : un compte `root` passe partout et masque les onze permissions
manquantes ; un compte `super_admin` se voit refuser les pages grand livre et transactions. C'est
probablement pour cela que la dérive n'a jamais été remarquée.

---

## Ce qu'il faut décider

Le design doit trancher au moins ceci — la liste n'est pas limitative :

1. **Où vit la vérité.** Un catalogue en code par feature, à l'image de `permissions.config.ts` ?
   Un catalogue central ? Et que devient le CRUD de permissions du back-office (R1) ?
2. **Ce que l'admin compose encore.** Des rôles seulement, ou aussi des permissions ?
3. **Comment la dérive est empêchée**, pas seulement corrigée : un test qui compare le code à la
   base, une commande de vérification, un échec au démarrage ? Les onze orphelines et les quatre
   fantômes doivent être détectables automatiquement, sinon elles reviendront.
4. **Le nom du rôle de contournement** — `root` ou `super_admin` — et s'il doit exister du tout.
5. **La convention de nommage.** Le dépôt mélange aujourd'hui `a.b` (`ledgers.read`) et `a:b`
   (`transfer:approve`), et parfois singulier/pluriel pour la même chose (`ledger.read` **et**
   `ledgers.read`). Trancher, et dire ce qu'on fait de l'existant.
6. **La migration.** Le RBAC est **en production** : rôles et permissions existent déjà. Compat,
   seed, slugs orphelins, ordre de déploiement.
7. **Le front.** Les énumérations par layer doivent-elles être générées, vérifiées, ou laissées
   telles quelles ?

Deux points sont déjà cadrés par les skills et n'ont pas à être rediscutés, seulement appliqués :
le découpage lecture/écriture et les incompatibilités de rôles relèvent de la section
**« Permissions & traçabilité »** désormais obligatoire dans `brainstorming`.

---

## Contraintes de travail

- Brainstorming avant chaque lot, migrations lancées par l'utilisateur.
- Règles à respecter : `docs/rules/2026-04-16-dto-conventions-rules.md`,
  `2026-07-05-type-placement-rules.md`, `2026-07-29-jsdoc-documentation-rules.md`.
- `npm run depcruise` doit rester à **0 erreur** (invariant `produit-consomme-core-par-service`).
- Baselines à ne pas dégrader : API `tsc` **74** erreurs, front `nuxi typecheck` **132**, tests
  **483 passés / 5 échecs** (les 5 sont préexistants : Kyc ×2, ProviderErrorService, DeviceService).
- Ne jamais commiter `backups.rar`.

## Après ce chantier

Reprendre le lot **O3** du document `docs/plans/2026-07-30-organisations-admin-design.md` : blocage
et activation d'une organisation, plus les compteurs d'en-tête. Il attend une décision sur ce que
« bloquer » interdit exactement — décaisser, encaisser, ou seulement se connecter — et sur le sort
d'un lot de paiement déjà approuvé au moment du blocage.

## Actions en attente côté utilisateur

```
node ace db:seed --files="database/seeders/organisation_permission_seeder.ts"
node ace db:seed --files="database/seeders/mass_transfer_permission_seeder.ts"
```
